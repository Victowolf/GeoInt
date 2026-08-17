"""
config.py
Loads the Groq API key from .env and exposes the two helpers every agent
uses:
  - call_llm(prompt, model=...)       -> raw text reply
  - get_structured_response(prompt)   -> parsed dict, with a self-healing
                                          retry if the model's reply isn't
                                          valid JSON

Also owns the shared rate limiting. See "Why the rate limiter changed"
below for the reasoning behind the current design.

---------------------------------------------------------------------------
Why the rate limiter changed
---------------------------------------------------------------------------
The previous version spaced call *starts* a fixed 1.5s apart. That looks
right but doesn't actually protect the account's TPM (tokens-per-minute)
budget, which is what Groq's 429s are about:

  "Rate limit reached for model `llama-3.3-70b-versatile` ... on tokens per
   minute (TPM): Limit 12000, Used 11347, Requested 1188."

Two things make fixed-interval spacing insufficient here:

1. compound-mini (SEARCH_MODEL_NAME) performs its own web search + tool
   calls under the hood. Those hidden tool-call/search tokens routinely run
   2-4x the size of the prompt you actually sent, and that size varies call
   to call. A fixed gap between call *starts* has no idea how many tokens
   the *previous* call actually burned, so three calls each "safely" spaced
   1.5s apart can still add up to more than the 12000 TPM budget within the
   same 60s window - which is exactly the failure in the error above (Used
   11347, i.e. nearly the whole budget, then one more request tips it over).

2. Agents 1, 2 and 5 all share SEARCH_MODEL_NAME and are fired concurrently
   by the orchestrator (asyncio.gather). Spacing alone doesn't account for
   that shared budget being drawn down by multiple agents in the same
   minute.

The fix: track actual token usage in a rolling 60s window per model (a
proper token bucket) and block a new call until there's genuinely room for
it, rather than just pacing call starts. Each call reserves an *estimate*
up front (so concurrent callers queue correctly instead of racing each
other into the same "there's room" window) and then corrects that estimate
against the real `usage.total_tokens` Groq returns, so the window stays
accurate as more calls complete.
"""
import os
import json
import re
import time
import threading
import logging
from collections import deque
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from groq import Groq, RateLimitError

log = logging.getLogger("sentinel.config")

# Load .env from this file's own folder, regardless of the working directory
# uvicorn (or its --reload subprocess) was launched from.
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

# ---------- Multi-key routing ----------
# Why: Agents 1, 2 and 5 all call SEARCH_MODEL_NAME (compound-mini) and all
# fire concurrently in the orchestrator's Fan step (asyncio.gather). Groq's
# TPM limit is enforced PER API KEY, PER MODEL - so on a single key, those
# three concurrent callers are all drawing down the SAME 12000 TPM budget at
# once, which is what actually causes the 429s described in this file's
# module docstring, even with a conservative safety margin.
#
# Fix: spread the three concurrent compound-mini callers across three
# different Groq keys, one budget each, instead of one shared budget split
# three ways:
#   KEY_A -> agent1 (compound-mini, Fan) + agent3 (gpt-oss-20b, Fan)
#   KEY_B -> agent2 (compound-mini, Fan) + agent4 (gpt-oss-20b, AFTER Fan)
#   KEY_C -> agent5 (compound-mini, Fan)
# agent1/agent3 sharing KEY_A is safe because they're different MODELS, so
# they hit different TPM buckets on Groq's side even on the same key.
# agent2/agent4 sharing KEY_B is safe because agent4 only runs AFTER the Fan
# step finishes (see orchestrator.py) - they never actually race each other.
#
# Backward compatible: if you only set GROQ_API_KEY (no _A/_B/_C), all three
# slots fall back to it and behave exactly like the old single-key setup -
# no code changes needed to keep running with one key.
_DEFAULT_KEY = os.getenv("GROQ_API_KEY")

GROQ_API_KEYS = {
    "A": os.getenv("GROQ_API_KEY_A", _DEFAULT_KEY),
    "B": os.getenv("GROQ_API_KEY_B", _DEFAULT_KEY),
    "C": os.getenv("GROQ_API_KEY_C", _DEFAULT_KEY),
}

_missing_or_placeholder = [
    label for label, key in GROQ_API_KEYS.items()
    if not key or key == "your_groq_api_key_here"
]
if _missing_or_placeholder:
    raise RuntimeError(
        f"Groq API key(s) missing for slot(s) {_missing_or_placeholder}. Set GROQ_API_KEY "
        f"(single-key fallback) or GROQ_API_KEY_A / GROQ_API_KEY_B / GROQ_API_KEY_C "
        f"(one key per hackathon account) in your .env file - see "
        f"https://console.groq.com/keys"
    )

# One Groq client per key slot, built once and reused.
_clients = {label: Groq(api_key=key) for label, key in GROQ_API_KEYS.items()}

# Which key slot each agent's calls should use. Agents not listed here (or a
# None/unrecognized agent_name) fall back to slot "A".
AGENT_KEY_SLOT = {
    "agent1": "A",
    "agent2": "B",
    "agent3": "A",
    "agent4": "B",
    "agent5": "C",
}

# Kept for any code that still imports `client` directly (back-compat) -
# points at slot A.
client = _clients["A"]

# ---------- Model selection ----------
# Only Agents 1, 2 and 5 genuinely need LIVE web search (current
# geopolitical events, current disruption scenarios, current market/supplier
# conditions) - they're the only callers of SEARCH_MODEL_NAME.
#
# compound-mini wraps GPT-OSS-120B + Llama 3.3 70B with a single-tool-call
# web search/code-execution layer (per Groq's docs, console.groq.com/docs/
# compound/systems/compound-mini). It's billed per underlying-model token
# plus a small per-search tool fee - there's no way around using SOME
# search-capable model for these 3 agents, since the whole point of their
# output is "what's happening right now."
SEARCH_MODEL_NAME = os.getenv("GROQ_SEARCH_MODEL", "groq/compound-mini")

# Agents 3 and 4 only combine/optimize data that's already been fetched by
# the other agents - they never need live web search - so they run on a
# plain (non-tool) reasoning model instead, off the compound-mini TPM
# budget entirely.
#
# Groq's non-search model ladder (per-1M-token, as of Aug 2026):
#   Llama 3.1 8B Instant  - $0.05 / $0.08  - fastest/cheapest, but weakest at
#                            reliably following a strict JSON schema (a real
#                            risk for Agent 3, which already needs the
#                            schema-repair retry in get_structured_response
#                            even on a stronger model)
#   GPT-OSS 20B            - $0.075 / $0.30 - half the input cost of 120B,
#                            faster, and still reliable at structured output
#                            -> default here
#   GPT-OSS 120B (old default) - $0.15 / $0.60 - noticeably pricier for a
#                            task that's pure combination, not deep reasoning
#
# Override with GROQ_LIGHT_MODEL if you want to push savings further (e.g.
# "llama-3.1-8b-instant") - just expect more schema-repair retries, since
# that model is more prone to the kind of malformed-checkpoints reply Agent
# 3 hit before (see agent3_prompt.py's explicit warnings about that).
LIGHT_MODEL_NAME = os.getenv("GROQ_LIGHT_MODEL", "openai/gpt-oss-20b")

# Kept as the default for any call that doesn't specify a model explicitly.
MODEL_NAME = SEARCH_MODEL_NAME

# ---------- TPM budgets (per model) ----------
# These are your account's actual Groq limits, PER KEY. Each of the 3 keys
# in GROQ_API_KEYS is assumed to be on the same tier (same limits) - if
# they're not (e.g. mixed free/paid accounts), override per-key below or
# just use the lowest common limit here to stay safe on all three.
# Don't just bump these blind - check console.groq.com/settings/limits on
# EACH account.
TPM_LIMITS = {
    SEARCH_MODEL_NAME: int(os.getenv("GROQ_TPM_SEARCH_MODEL", "12000")),
    LIGHT_MODEL_NAME: int(os.getenv("GROQ_TPM_LIGHT_MODEL", "15000")),
}
# Cap how many tokens a single completion is allowed to generate. This bounds
# the "Requested" side of the TPM equation directly instead of hoping the
# model replies concisely - a large max_tokens is the easiest way to blow a
# 12000 TPM budget with just 2-3 calls.
MAX_COMPLETION_TOKENS = {
    SEARCH_MODEL_NAME: int(os.getenv("GROQ_MAX_TOKENS_SEARCH_MODEL", "1400")),
    LIGHT_MODEL_NAME: int(os.getenv("GROQ_MAX_TOKENS_LIGHT_MODEL", "1400")),
}

_RETRY_AFTER_RE = re.compile(r"try again in ([\d.]+)s", re.IGNORECASE)


# ---------- Rate limiting: token bucket per model ----------
class TokenBucketLimiter:
    """Rolling-window (60s) token budget for one model. Blocks the caller
    until `estimated_tokens` fits under `tpm_limit` for that window, then
    reserves the slot immediately (so multiple threads queue correctly
    instead of racing). Call `update_actual` once the real token usage is
    known to keep the window honest.
    """

    def __init__(self, tpm_limit: int, window_seconds: float = 60.0, safety_margin: float = 0.85):
        # safety_margin: stay under the *stated* limit on purpose. Groq's
        # own usage accounting and our estimate won't line up to the token,
        # so leaving ~15% headroom is what actually keeps us out of 429s
        # rather than clipping the limit exactly and losing the race.
        self.tpm_limit = max(1, int(tpm_limit * safety_margin))
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
        self._order = deque()   # slot ids, oldest first
        self._entries = {}      # slot id -> [timestamp, tokens]
        self._next_id = 0

    def _prune_locked(self, now: float) -> None:
        while self._order and now - self._entries[self._order[0]][0] > self.window_seconds:
            old_id = self._order.popleft()
            del self._entries[old_id]

    def _used_locked(self, now: float) -> int:
        self._prune_locked(now)
        return sum(tok for _, tok in self._entries.values())

    def reserve(self, estimated_tokens: int) -> int:
        while True:
            with self._lock:
                now = time.monotonic()
                used = self._used_locked(now)
                if used + estimated_tokens <= self.tpm_limit or not self._entries:
                    # `or not self._entries` avoids permanent deadlock if a
                    # single request's own estimate exceeds the whole budget.
                    slot_id = self._next_id
                    self._next_id += 1
                    self._entries[slot_id] = [now, estimated_tokens]
                    self._order.append(slot_id)
                    return slot_id
                oldest_ts = self._entries[self._order[0]][0]
                wait_time = self.window_seconds - (now - oldest_ts) + 0.1
            time.sleep(max(wait_time, 0.1))

    def update_actual(self, slot_id: int, actual_tokens: int) -> None:
        with self._lock:
            if slot_id in self._entries:
                self._entries[slot_id][0] = self._entries[slot_id][0]
                self._entries[slot_id][1] = actual_tokens

    def release(self, slot_id: int) -> None:
        """Drop a reservation entirely (call failed before consuming any
        real tokens, e.g. a connection error) so it doesn't sit in the
        window counting against the budget for nothing."""
        with self._lock:
            if slot_id in self._entries:
                self._entries[slot_id][1] = 0


# Limiters are keyed by (key_slot, model), not just model - this is the
# whole point of the multi-key split above. Each Groq key gets its OWN
# rolling-window budget per model, matching how Groq actually enforces TPM,
# instead of every key sharing one bucket per model (which would silently
# defeat the point of using separate keys at all).
_limiters = {}
_limiters_lock = threading.Lock()


def _get_limiter(key_slot: str, model: str) -> "TokenBucketLimiter":
    cache_key = (key_slot, model)
    with _limiters_lock:
        limiter = _limiters.get(cache_key)
        if limiter is None:
            limiter = TokenBucketLimiter(TPM_LIMITS.get(model, 12000))
            _limiters[cache_key] = limiter
        return limiter


# A small minimum gap between call *starts* on top of the token budget -
# belt-and-suspenders against request-per-minute limits, which are separate
# from TPM and not covered by the token bucket at all. Also keyed by
# (key_slot, model) so calls on different keys don't wait on each other.
_MIN_CALL_GAP_SECONDS = 1.0
_last_call_lock = threading.Lock()
_last_call_at = {}


def _space_call_start(key_slot: str, model: str) -> None:
    cache_key = (key_slot, model)
    with _last_call_lock:
        now = time.monotonic()
        wait = _MIN_CALL_GAP_SECONDS - (now - _last_call_at.get(cache_key, 0.0))
        _last_call_at[cache_key] = max(now, _last_call_at.get(cache_key, 0.0)) + _MIN_CALL_GAP_SECONDS
    if wait > 0:
        time.sleep(wait)


def _estimate_tokens(prompt: str, model: str) -> int:
    """Rough pre-call estimate so the bucket has something to reserve
    against before the real usage is known. ~4 chars/token is the standard
    rule-of-thumb for English text."""
    base = max(len(prompt) // 4, 50)
    if model == SEARCH_MODEL_NAME:
        # compound-mini's hidden web-search/tool-call traffic (see module
        # docstring) reliably dwarfs the prompt itself - estimate generously
        # so the bucket reserves real headroom instead of finding out only
        # after a 429.
        return int(base * 3.5) + 800
    return int(base * 1.3) + 300


def _extract_wait_seconds(err: RateLimitError, fallback: float) -> float:
    """Groq's 429 message includes the exact wait time, e.g. 'try again in 7.075s'.
    Use that instead of guessing with a fixed backoff."""
    match = _RETRY_AFTER_RE.search(str(err))
    if match:
        return float(match.group(1)) + 0.5  # small buffer
    return fallback


_REQUEST_TOO_LARGE_MARKERS = ("request_too_large", "request entity too large", "413")


def _is_request_too_large(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(marker in msg for marker in _REQUEST_TOO_LARGE_MARKERS)


def _shrink_prompt(prompt: str, keep_start_chars: int = 1200, keep_end_chars: int = 1200) -> str:
    """Compact a prompt that Groq rejected as too large (413), for a single
    retry. A 413 here isn't about our TPM budget (that's the token bucket's
    job) - it's Groq rejecting the outgoing request body outright, which can
    happen even for a modest-looking prompt once compound-mini's own hidden
    web-search/tool-call overhead is added on Groq's side (see module
    docstring). Retrying the identical prompt would just 413 again, so this
    keeps the instructional head (task + rules) and the tail (the JSON
    schema the model must follow - critical for a parseable reply) and
    drops the middle, which is usually where per-field elaboration lives."""
    if len(prompt) <= keep_start_chars + keep_end_chars:
        return prompt
    head = prompt[:keep_start_chars]
    tail = prompt[-keep_end_chars:]
    return (
        f"{head}\n\n"
        "[...trimmed for length - keep following the instructions above and "
        "the exact JSON shape below...]\n\n"
        f"{tail}"
    )


# Progressive shrink stages for repeated 413s within one call_llm() call.
# One stage (the old behavior) isn't always enough: a request can still
# 413 at 2500 chars if the size pressure is coming from compound-mini's
# own hidden tool-call/search context rather than our outgoing prompt text
# (this is exactly what happened to Agent 5 - a SHORTER original prompt
# than Agent 2's still 413'd again at the same shrunk length that worked
# fine for Agent 2, because Agent 5 asks for more distinct search topics
# per call, which drives more server-side tool overhead regardless of our
# prompt size). Each stage keeps less of the original prompt, always
# anchored on the same already-shrunk text from the previous stage (so
# repeated shrinks converge instead of oscillating), down to a floor
# that's still enough to carry the JSON schema.
_SHRINK_STAGES = [(1200, 1200), (700, 700), (400, 400)]


def call_llm(
    prompt: str,
    model: Optional[str] = None,
    max_retries: int = 6,
    agent_name: Optional[str] = None,
) -> str:
    """Send a single prompt to Groq and return the raw text reply.

    `agent_name` (e.g. "agent1") selects which Groq API key this call uses,
    via AGENT_KEY_SLOT - this is what actually gives Agents 1/2/5 separate
    TPM budgets instead of fighting over one. Unset/unrecognized agent_name
    falls back to key slot "A" (same as the old single-key behavior).

    Self-throttles against that (key, model) pair's TPM budget before every
    attempt, then reconciles the reservation against real usage once the
    response comes back. On 429, waits exactly as long as Groq says is
    needed before retrying. On 413 (request too large - a body-size
    rejection, not a TPM issue), progressively re-shrinks the prompt
    through _SHRINK_STAGES and retries, instead of giving up after a single
    shrink attempt - some calls (see _SHRINK_STAGES' docstring) still 413
    at a size that worked fine for other agents, because the size pressure
    can come from the search model's own hidden tool-call context rather
    than our prompt text, and one trim isn't always enough headroom.
    max_retries defaults higher than before (6, was 4) specifically to give
    those shrink stages room to run without also starving normal 429
    backoff retries in the same call."""
    model = model or MODEL_NAME
    key_slot = AGENT_KEY_SLOT.get(agent_name, "A")
    agent_client = _clients[key_slot]
    limiter = _get_limiter(key_slot, model)
    max_tokens = MAX_COMPLETION_TOKENS.get(model, 1400)
    shrink_stage = 0  # index into _SHRINK_STAGES; advances on each 413

    # GPT-OSS models spend hidden reasoning tokens out of the SAME
    # max_tokens budget before writing the final answer - on a small budget
    # like 1400, that reasoning can eat the whole thing and leave nothing
    # for the actual JSON reply (the "Agent 3/4 return empty string" failure
    # mode in the README). Capping reasoning effort to "low" for this model
    # leaves the budget mostly for the answer itself. Only applies to
    # LIGHT_MODEL_NAME - compound-mini doesn't use this param.
    extra_kwargs = {}
    if model == LIGHT_MODEL_NAME:
        extra_kwargs["reasoning_effort"] = os.getenv("GROQ_LIGHT_REASONING_EFFORT", "low")

    for attempt in range(max_retries):
        _space_call_start(key_slot, model)
        estimate = _estimate_tokens(prompt, model)
        slot_id = limiter.reserve(estimate)
        try:
            completion = agent_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                **extra_kwargs,
            )
            usage = getattr(completion, "usage", None)
            actual = getattr(usage, "total_tokens", None) if usage else None
            limiter.update_actual(slot_id, actual if actual else estimate)
            return completion.choices[0].message.content
        except RateLimitError as e:
            limiter.update_actual(slot_id, estimate)  # it clearly did count against the budget
            if attempt == max_retries - 1:
                raise
            wait = _extract_wait_seconds(e, fallback=2 ** attempt)
            log.warning(
                "call_llm: 429 on %s (key=%s), waiting %.1fs before retry %d/%d",
                model, key_slot, wait, attempt + 1, max_retries,
            )
            time.sleep(wait)
        except Exception as exc:
            limiter.release(slot_id)  # failed before consuming tokens - don't count it
            if _is_request_too_large(exc) and shrink_stage < len(_SHRINK_STAGES):
                keep_start, keep_end = _SHRINK_STAGES[shrink_stage]
                shrink_stage += 1
                original_len = len(prompt)
                prompt = _shrink_prompt(prompt, keep_start_chars=keep_start, keep_end_chars=keep_end)
                log.warning(
                    "call_llm: 413 on %s (key=%s), retrying with shrink stage %d/%d (%d -> %d chars)",
                    model, key_slot, shrink_stage, len(_SHRINK_STAGES), original_len, len(prompt),
                )
                continue
            raise


# ---------- JSON parsing ----------
def _strip_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    return cleaned.strip()


def _try_parse(text: str) -> Optional[dict]:
    cleaned = _strip_fences(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Fallback: the model added a preamble/trailing commentary around the
    # JSON ("Here's the JSON:\n{...}\nLet me know if..."). Extract the
    # outermost {...} block and try again before giving up.
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def safe_json_parse(text: str) -> dict:
    """Kept for backward compatibility / simple callers. Prefer
    get_structured_response() in agent code, since it can self-heal."""
    parsed = _try_parse(text)
    if parsed is None:
        raise json.JSONDecodeError("Could not parse JSON from LLM reply", text, 0)
    return parsed


# Cap on how much of the previous (unparseable) reply AND how much of the
# original task prompt get embedded in a repair prompt. Repair prompts now
# carry both (see get_structured_response), so this is kept modest to avoid
# the repair call itself risking a 413/429 on top of the original failure -
# only the tail of the broken reply is useful anyway (the JSON object, if
# present at all, is usually near the end), and the head of the task prompt
# is where the core instructions live.
MAX_REPAIR_CONTEXT_CHARS = 2500


def get_structured_response(
    prompt: str,
    model: Optional[str] = None,
    max_repair_attempts: int = 2,
    validate: Optional[callable] = None,
    agent_name: Optional[str] = None,
) -> dict:
    """Call the LLM and parse its reply as JSON, with self-healing retries
    if parsing fails.

    `validate`, if given, is called as `validate(parsed_dict)` and should
    raise (e.g. a pydantic ValidationError) if the dict doesn't actually
    satisfy the target schema. This matters because valid JSON and a
    *correct* reply aren't the same thing: a reply can parse fine as JSON
    while still having the wrong field types or missing required fields
    (e.g. putting waypoint names into an integer flags list, or dropping a
    required field for one item in a list) - the old parse-only check
    didn't catch that, so a schema-invalid reply reached the caller as if
    it had succeeded, only to blow up later at `Model(**parsed)`. When
    `validate` raises, this reuses the same repair loop as invalid JSON,
    but tells the model exactly what was wrong so it can fix that specific
    problem instead of blindly regenerating.

    Two failure modes get handled differently:
      - A near-empty reply (e.g. bare "{}" or a couple of stray characters)
        means the model effectively produced nothing usable - a "fix this
        JSON" prompt built around an empty object gives it nothing to
        repair, and models (especially smaller/cheaper ones) tend to just
        return another empty object in response. In that case this skips
        the "repair" framing entirely and re-sends the ORIGINAL prompt
        fresh instead, which is a real second chance rather than a doomed
        nudge.
      - A substantive-but-wrong reply (real JSON, wrong shape, or JSON with
        actual content but a validation error) DOES get the standard repair
        prompt - but that prompt now also carries the original task prompt
        (or a truncated head of it) alongside the broken output, since a
        repair instruction with only "here's what's wrong" and no context
        about the actual task (destinations, budget, etc.) is often not
        enough for smaller reasoning models to regenerate a correct,
        complete reply from scratch.

    If a repair call itself fails with a request-too-large error, that's
    treated as non-retryable: give up gracefully (raise a clear ValueError)
    rather than looping into more oversized requests.

    `agent_name` is forwarded to every call_llm() call below (initial call
    AND both repair paths) so retries stay on the same Groq key the agent
    was assigned - see AGENT_KEY_SLOT in this file."""
    raw = call_llm(prompt, model=model, agent_name=agent_name)
    parsed = _try_parse(raw)
    validation_error: Optional[str] = None
    if parsed is not None and validate is not None:
        try:
            validate(parsed)
        except Exception as exc:
            validation_error = str(exc)
            parsed = None  # treat as unusable until repaired, same as bad JSON

    # Below this length, treat the reply as "effectively empty" rather than
    # "wrong but repairable" - e.g. "{}", "{ }", "null", or a stray fragment.
    MIN_SUBSTANTIVE_REPLY_CHARS = 30
    attempts = 0
    while parsed is None and attempts < max_repair_attempts:
        near_empty = len(raw.strip()) < MIN_SUBSTANTIVE_REPLY_CHARS

        if near_empty:
            log.warning(
                "get_structured_response: previous reply was near-empty (%r) - "
                "retrying with the original prompt instead of a repair nudge (try %d)",
                raw.strip(), attempts + 1,
            )
            next_prompt = prompt
        else:
            truncated_reply = raw if len(raw) <= MAX_REPAIR_CONTEXT_CHARS else raw[-MAX_REPAIR_CONTEXT_CHARS:]
            truncated_task = prompt if len(prompt) <= MAX_REPAIR_CONTEXT_CHARS else prompt[:MAX_REPAIR_CONTEXT_CHARS]
            if validation_error:
                log.warning("get_structured_response: reply failed schema validation, attempting repair (try %d)", attempts + 1)
                next_prompt = (
                    "You are correcting your own previous reply to the task below - it was "
                    "valid JSON but did NOT match the required schema.\n\n"
                    f"ORIGINAL TASK (for context - follow its instructions and JSON shape):\n{truncated_task}\n\n"
                    f"YOUR PREVIOUS (INCORRECT) REPLY:\n{truncated_reply}\n\n"
                    f"VALIDATION ERROR(S) TO FIX:\n{validation_error}\n\n"
                    "Return ONLY the corrected, complete, valid JSON object for the original task "
                    "above, fixing EXACTLY the problem(s) described while keeping everything else "
                    "consistent with the original task. No markdown fences, no preamble, no "
                    "commentary - JSON only."
                )
            else:
                log.warning("get_structured_response: reply wasn't valid JSON, attempting repair (try %d)", attempts + 1)
                next_prompt = (
                    "You are correcting your own previous reply to the task below - it was NOT "
                    "valid JSON and could not be parsed.\n\n"
                    f"ORIGINAL TASK (for context - follow its instructions and JSON shape):\n{truncated_task}\n\n"
                    f"YOUR PREVIOUS (UNPARSEABLE) REPLY:\n{truncated_reply}\n\n"
                    "Return ONLY the corrected, complete, valid JSON object equivalent to the "
                    "intended reply for the original task above. No markdown fences, no preamble, "
                    "no commentary - JSON only."
                )

        try:
            raw = call_llm(next_prompt, model=model, agent_name=agent_name)
        except Exception as exc:
            if _is_request_too_large(exc):
                log.warning("get_structured_response: repair call itself was too large, giving up on repair")
                break
            raise
        parsed = _try_parse(raw)
        validation_error = None
        if parsed is not None and validate is not None:
            try:
                validate(parsed)
            except Exception as exc:
                validation_error = str(exc)
                parsed = None
        attempts += 1

    if parsed is None:
        reason = f"schema validation ({validation_error})" if validation_error else "valid JSON"
        raise ValueError(
            f"LLM did not return {reason} after {attempts + 1} attempt(s). "
            f"Last raw reply (truncated): {raw[:500]!r}"
        )
    return parsed