"""
orchestrator.py
Runs the 5 agents in true dependency order:

  Agent1, Agent2, Agent3, Agent5 all run in parallel — none of them
  depend on another agent's output, only on the original request.

  Agent4 (decision advisor) runs afterward, once Agent1-3 have finished,
  since it consumes their combined output. Agent5 does NOT need to wait
  for Agent4 or Agent1 (it's independent of both), so it's fired alongside
  everything else.

MEMORY (this revision - read AND write, not just write):

  BEFORE the agents run: memory.recall_context() queries CockroachDB's
  vector-indexed `memories` table for prior findings on this exact route,
  and (if data.session_id is given) memory.get_task_context() looks up
  this session's last known state from `agent_state`. Both are injected
  into Agent 1/2/5's prompts as `prior_context` (see models.py,
  agent1.py/agent2.py/agent5.py). This is the change that makes memory
  *agentic* - it actually alters what the model reasons about on this
  call, instead of only being written after the fact for later audit.

  AFTER the agents run: the full run is persisted (memory.py's
  persist_orchestration - unchanged from before), AND (if session_id was
  given) memory.update_task_context() writes this session's new
  route/budget/verdict back to `agent_state`, so the *next* call in the
  same session can reference it.

  Once Agent1 AND Agent5 have both finished, a lightweight deterministic
  (non-LLM) step (advisory.py) enriches Agent 5's risk_adjusted_note using
  Agent 1's actual computed risk_score.

Rate limiting against Groq's TPM budget is handled centrally in config.py.
Every call path, including this one, is protected automatically.

If an individual agent raises, its error is captured in `errors` instead
of failing the whole orchestration. Agent4 is skipped if any of Agent1-3
failed, since it has nothing valid to combine.
"""
import asyncio
import logging
import uuid
from typing import Optional

from models import (
    OrchestratorInput, OrchestratorOutput,
    Agent1Input, Agent2Input, Agent3Input, Agent4Input, Agent5Input,
    Agent4Agent1, Agent4Agent2, Agent4Agent3, TaskContext,
)
from agent1 import run_agent1
from agent2 import run_agent2
from agent3 import run_agent3
from agent4 import run_agent4
from agent5 import run_agent5
from advisory import apply_route_risk_context
from memory import persist_orchestration, recall_context, get_task_context, update_task_context

log = logging.getLogger("sentinel.orchestrator")


async def _safe_run(agent_name: str, fn, arg, errors: dict):
    """Run a blocking agent function in a worker thread; on failure, record
    the error under `agent_name` and return None instead of propagating, so
    one agent failing doesn't take down the whole orchestration."""
    try:
        return await asyncio.to_thread(fn, arg)
    except Exception as exc:  # noqa: BLE001 - any agent failure is meant to be caught here
        log.exception("%s failed", agent_name)
        errors[agent_name] = str(exc)
        return None


async def _noop_none():
    """Used alongside asyncio.gather when no session_id was given, so the
    gather() call always has a matching second awaitable regardless of
    whether session lookup is actually needed - keeps the gather() call
    site simple (no branching on session_id there)."""
    return None


def _build_prior_context_text(recalled: list, task_context: Optional[dict]) -> str:
    """Combine vector-recalled memory snippets and any known session state
    into one plain-text block to append to an agent's prompt. Returns ""
    if there's genuinely nothing to inject (first-ever call on this route
    with no session history) - agents treat an empty prior_context exactly
    as before this change, so a cold-start route behaves identically to
    the pre-memory version of this pipeline."""
    parts = []
    if recalled:
        parts.append("Recent findings from prior runs on this route:\n- " + "\n- ".join(recalled))
    if task_context and task_context.get("call_count", 0) > 0:
        parts.append(
            f"This session has queried this route {task_context.get('call_count')} time(s) before. "
            f"Last known budget: {task_context.get('last_budget', 'unknown')}. "
            f"Last verdict given: {task_context.get('last_suggestion', 'unknown')}."
        )
    return "\n\n".join(parts)


async def run_orchestration(data: OrchestratorInput) -> OrchestratorOutput:
    errors: dict = {}

    # --- MEMORY RECALL (before any agent runs) ---
    # Both calls are blocking DB/embedding operations - run in a worker
    # thread so they don't stall the event loop. Both already swallow
    # their own errors internally (see memory.py) and return safe empty
    # defaults ([] / None) on any failure, so a CockroachDB hiccup here
    # degrades gracefully to "no prior context" rather than breaking the
    # request.
    recalled_snippets, prior_task_context = await asyncio.gather(
        asyncio.to_thread(
            recall_context, data.origin, data.destinations,
            f"{data.commodity_name} {data.sector.value} {data.intent.value}", 3,
        ),
        asyncio.to_thread(get_task_context, data.session_id) if data.session_id else _noop_none(),
    )
    prior_context_text = _build_prior_context_text(recalled_snippets, prior_task_context)

    session_continuity_note = None
    if data.session_id and prior_task_context:
        session_continuity_note = (
            f"Recognized returning session (call #{prior_task_context.get('call_count', 0) + 1} "
            f"for this session)."
        )

    a1_in = Agent1Input(
        origin=data.origin,
        destinations=data.destinations,
        preferred_transport=data.preferred_transport,
        sector=data.sector,
        prior_context=prior_context_text,
    )
    a2_in = Agent2Input(
        origin=data.origin,
        destinations=data.destinations,
        preferred_transport=data.preferred_transport,
        budget=data.budget,
        sector=data.sector,
        intent=data.intent,
        commodity_name=data.commodity_name,
        quantity=data.quantity,
        expected_price=data.expected_price,
        prior_context=prior_context_text,
    )
    a3_in = Agent3Input(
        origin=data.origin,
        destinations=data.destinations,
        mandatory_checkpoints=data.mandatory_checkpoints,
        preferred_transport=data.preferred_transport,
        budget=data.budget,
        maximum_duration=data.maximum_duration,
    )
    a5_in = Agent5Input(
        origin=data.origin,
        destinations=data.destinations,
        mandatory_checkpoints=data.mandatory_checkpoints,
        preferred_transport=data.preferred_transport,
        budget=data.budget,
        maximum_duration=data.maximum_duration,
        sector=data.sector,
        intent=data.intent,
        commodity_name=data.commodity_name,
        quantity=data.quantity,
        expected_price=data.expected_price,
        prior_context=prior_context_text,
    )

    # Agents 1, 2, 3 and 5 are mutually independent -> fire together.
    a1_out, a2_out, a3_out, a5_out = await asyncio.gather(
        _safe_run("agent1", run_agent1, a1_in, errors),
        _safe_run("agent2", run_agent2, a2_in, errors),
        _safe_run("agent3", run_agent3, a3_in, errors),
        _safe_run("agent5", run_agent5, a5_in, errors),
    )

    if a1_out and a5_out:
        try:
            a5_out = apply_route_risk_context(a5_out, a1_out)
        except Exception:
            log.exception("apply_route_risk_context failed; leaving agent5 output as-is")

    a4_out = None
    if a1_out and a2_out and a3_out:
        least_risk_route = min(a3_out.alternative_routes, key=lambda r: r.risk_score)
        a4_in = Agent4Input(
            agent1=Agent4Agent1(risk_score=a1_out.consolidated.risk_score, destinations=a1_out.destinations),
            agent2=Agent4Agent2(supply_chain_analysis=a2_out.consolidated.supply_chain_analysis),
            agent3=Agent4Agent3(least_risk_route=least_risk_route),
        )
        a4_out = await _safe_run("agent4", run_agent4, a4_in, errors)
    else:
        errors["agent4"] = "skipped: requires agent1, agent2 and agent3 to all succeed"

    output = OrchestratorOutput(
        agent1=a1_out,
        agent2=a2_out,
        agent3=a3_out,
        agent4=a4_out,
        agent5=a5_out,
        errors=errors,
        session_continuity_note=session_continuity_note,
    )

    # --- PERSIST: full run + vector memories (same as before this revision) ---
    # If the caller gave us a session_id, the stored run should carry that
    # same session_id so shipment_runs and agent_state actually correlate.
    # A fresh random id is only generated as a fallback for a stateless,
    # session-less call, since shipment_runs.session_id is NOT NULL.
    run_id = None
    try:
        run_id = await asyncio.to_thread(
            persist_orchestration, data.session_id or str(uuid.uuid4()), data, output
        )
        if run_id:
            log.info("orchestration persisted to CockroachDB: run_id=%s", run_id)
        else:
            log.warning("orchestration NOT persisted to CockroachDB (see memory.py logs above)")
    except Exception:
        log.exception("unexpected error while persisting orchestration; returning response anyway")

    # --- PERSIST: agent_state session continuity (new this revision) ---
    if data.session_id:
        prior_call_count = prior_task_context.get("call_count", 0) if prior_task_context else 0
        new_context = TaskContext(
            last_origin=data.origin,
            last_destinations=list(data.destinations),
            last_budget=data.budget,
            last_suggestion=(
                a4_out.suggestion.value if a4_out
                else (prior_task_context or {}).get("last_suggestion", "")
            ),
            call_count=prior_call_count + 1,
        )
        try:
            await asyncio.to_thread(
                update_task_context, data.session_id, run_id, new_context.model_dump()
            )
        except Exception:
            log.exception("failed to update agent_state for session_id=%s", data.session_id)

    return output
