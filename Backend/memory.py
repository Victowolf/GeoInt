"""
memory.py
CockroachDB persistence layer for Sentinel.

Two things happen on every /orchestrator/run call:
  1. store_run()    - the FULL input (OrchestratorInput) and FULL output
                       (OrchestratorOutput) are written as one row in
                       shipment_runs, as JSONB - nothing is summarized or
                       dropped, so any past run can be replayed or audited
                       exactly as it happened.
  2. store_memory() - the human-readable "takeaway" text from each agent
                       (simple_summary, supply_chain_analysis, etc.) is
                       embedded into a vector and written into `memories`,
                       so future runs on the same/similar route can recall
                       relevant prior context via semantic search instead
                       of starting cold every time (recall_context()).

Both writes are wrapped in try/except by the caller (orchestrator.py) - a
CockroachDB hiccup should never break the API response the frontend is
waiting on, same "don't let persistence break the request" principle
already used for individual agent failures in orchestrator.py.

Embeddings use a local, free, open-source model (fastembed /
BAAI/bge-small-en-v1.5, 384 dimensions) - no paid API, no Bedrock
dependency. If you swap embedding models later, remember to also change
the VECTOR(384) dimension in the CREATE TABLE statement to match.
"""
import os
import json
import logging
import uuid
from functools import lru_cache
from typing import List, Optional

from dotenv import load_dotenv
import pg8000.native
from fastembed import TextEmbedding

load_dotenv()  # no-op if no .env file is present (e.g. on Lambda)

log = logging.getLogger("sentinel.memory")

_EMBED_DIM = 384  # must match VECTOR(384) in the memories table


# ---------------------------------------------------------------------
# Embedding model - loaded once per process (Lambda cold start / uvicorn
# worker start), reused across every call after that.
# ---------------------------------------------------------------------
@lru_cache(maxsize=1)
def _embed_model() -> TextEmbedding:
    return TextEmbedding(model_name="BAAI/bge-small-en-v1.5")


def embed(text: str) -> List[float]:
    """Turn a piece of text into a 384-dim embedding vector."""
    if not text or not text.strip():
        # Zero vector for empty text rather than calling the model on
        # nothing - keeps callers from having to special-case this.
        return [0.0] * _EMBED_DIM
    vec = list(_embed_model().embed([text]))[0]
    return vec.tolist()


def _vector_literal(vec: List[float]) -> str:
    """pg8000 has no native VECTOR param type - it just sends whatever
    Python value you give it as a bind param, and CockroachDB's VECTOR
    parser only accepts its own string literal format: "[0.1,0.2,...]"
    (must start with '[' and end with ']', comma-separated, no spaces
    required). Passing a raw Python list instead produces exactly the
    error seen in the logs: 'malformed vector literal'. This converts the
    embedding into that exact string so it can be bound as a normal text
    param and cast with ::VECTOR(384) in the SQL itself (see the INSERT/
    SELECT statements below)."""
    return "[" + ",".join(repr(float(x)) for x in vec) + "]"


# ---------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------
def _require_env(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        raise RuntimeError(
            f"memory.py: required environment variable '{key}' is not set. "
            f"Copy .env.example to .env and fill it in (local dev), or set it "
            f"in the Lambda console's Environment variables (deployed)."
        )
    return val


def get_conn() -> pg8000.native.Connection:
    """One short-lived connection per call. Cheap enough for a hackathon
    demo's traffic; swap for a pooled connection (e.g. via PgBouncer or a
    module-level connection reused across warm Lambda invocations) if you
    need to scale this past a demo."""
    return pg8000.native.Connection(
        user=_require_env("COCKROACH_USER"),
        password=_require_env("COCKROACH_PASSWORD"),
        host=_require_env("COCKROACH_HOST"),
        port=int(os.environ.get("COCKROACH_PORT", "26257")),
        database=os.environ.get("COCKROACH_DB", "defaultdb"),
        ssl_context=True,
    )


def _route_key(origin: str, destinations: List[str]) -> str:
    """Normalized key used to pre-filter memories to the same route before
    ranking by vector similarity - keeps recall relevant instead of
    matching semantically-similar-but-unrelated shipments."""
    return "|".join([origin.strip().lower()] + [d.strip().lower() for d in destinations])


# ---------------------------------------------------------------------
# WRITE: full input + full output for this run
# ---------------------------------------------------------------------
def store_run(session_id: str, data, output) -> Optional[str]:
    """Persist the complete OrchestratorInput and OrchestratorOutput for
    this run as one row. Returns the new run_id (used to tag the
    memories/ rows written alongside it), or None if the write failed.
    """
    run_id = str(uuid.uuid4())
    try:
        conn = get_conn()
        try:
            conn.run(
                """
                INSERT INTO shipment_runs
                    (id, session_id, origin, destinations, sector, intent,
                     commodity_name, budget, risk_score, suggestion,
                     request_json, response_json, errors)
                VALUES
                    (:id, :sid, :origin, :dests, :sector, :intent,
                     :commodity, :budget, :risk, :suggestion,
                     :req, :resp, :errs)
                """,
                id=run_id,
                sid=session_id,
                origin=data.origin,
                dests=list(data.destinations),
                sector=data.sector.value,
                intent=data.intent.value,
                commodity=data.commodity_name,
                budget=data.budget,
                risk=output.agent1.consolidated.risk_score if output.agent1 else None,
                suggestion=output.agent4.suggestion.value if output.agent4 else None,
                req=data.model_dump_json(),
                resp=output.model_dump_json(),
                errs=json.dumps(output.errors or {}),
            )
        finally:
            conn.close()
        return run_id
    except Exception:
        log.exception("store_run: failed to persist shipment_runs row")
        return None


# ---------------------------------------------------------------------
# WRITE: one embedded memory row (called once per agent that produced
# useful takeaway text)
# ---------------------------------------------------------------------
def store_memory(run_id: str, agent_name: str, route_key: str, content: str) -> None:
    """Embed `content` and write it into memories, tagged with run_id
    (links back to the full shipment_runs row), agent_name, and
    route_key (for pre-filtered recall). No-ops silently on empty content
    or on any DB error - a failed memory write should never break the
    response already computed for the user."""
    if not content or not content.strip():
        return
    try:
        conn = get_conn()
        try:
            conn.run(
                """
                INSERT INTO memories (run_id, agent_name, route_key, content, embedding)
                VALUES (:rid, :agent, :rk, :content, :emb::VECTOR(384))
                """,
                rid=run_id,
                agent=agent_name,
                rk=route_key,
                content=content,
                emb=_vector_literal(embed(content)),
            )
        finally:
            conn.close()
    except Exception:
        log.exception("store_memory: failed to persist memory row for agent=%s", agent_name)


# ---------------------------------------------------------------------
# WRITE (convenience): store_run + store_memory for every agent in one call
# ---------------------------------------------------------------------
def persist_orchestration(session_id: str, data, output) -> Optional[str]:
    """Single entry point orchestrator.py calls at the end of
    run_orchestration(). Stores the full run, then embeds+stores each
    agent's human-readable takeaway. Returns run_id, or None if even the
    initial shipment_runs write failed (in which case nothing else was
    attempted either)."""
    run_id = store_run(session_id, data, output)
    if run_id is None:
        return None

    route_key = _route_key(data.origin, data.destinations)

    if output.agent1:
        store_memory(run_id, "agent1", route_key, output.agent1.consolidated.simple_summary)
    if output.agent2:
        store_memory(run_id, "agent2", route_key, output.agent2.consolidated.supply_chain_analysis)
        store_memory(run_id, "agent2", route_key, output.agent2.consolidated.simple_summary)
    if output.agent3:
        store_memory(run_id, "agent3", route_key, output.agent3.consolidated.simple_summary)
    if output.agent5:
        store_memory(run_id, "agent5", route_key, output.agent5.recommended_action)
        store_memory(run_id, "agent5", route_key, output.agent5.demand_assessment)
    if output.agent4:
        store_memory(run_id, "agent4", route_key, " ".join(output.agent4.reason))

    return run_id


# ---------------------------------------------------------------------
# READ/WRITE: agent_state (session continuity across repeated calls)
#
# Previously defined in schema.sql but never actually used by any code
# path - every row stayed empty. This activates it: a returning
# session_id gets its last route/budget/verdict back before the agents
# run, and an updated snapshot is written after. This is what turns
# "memory" from a per-request audit log into something that persists
# understanding of a specific ongoing conversation/session.
# ---------------------------------------------------------------------
def get_task_context(session_id: str) -> Optional[dict]:
    """Return the stored task_context dict for this session_id, or None if
    this session has never been seen before (first call) or on any DB
    error - callers should treat this as optional prior state, never a
    hard dependency for the request to proceed."""
    if not session_id:
        return None
    try:
        conn = get_conn()
        try:
            rows = conn.run(
                "SELECT task_context FROM agent_state WHERE session_id = :sid",
                sid=session_id,
            )
        finally:
            conn.close()
        if not rows:
            return None
        # pg8000 returns JSONB columns already decoded as Python dict/list
        return rows[0][0]
    except Exception:
        log.exception("get_task_context: failed to read agent_state for session_id=%s", session_id)
        return None


def update_task_context(session_id: str, run_id: Optional[str], task_context: dict) -> None:
    """Upsert this session's task_context - CockroachDB (Postgres-compatible)
    supports ON CONFLICT ... DO UPDATE, so this is a single atomic
    write whether the session is new or returning. No-ops silently on any
    DB error - a failed session-state write should never break the
    response already computed for the user."""
    if not session_id:
        return
    try:
        conn = get_conn()
        try:
            conn.run(
                """
                INSERT INTO agent_state (session_id, last_run_id, task_context, updated_at)
                VALUES (:sid, :rid, :ctx, now())
                ON CONFLICT (session_id) DO UPDATE
                SET last_run_id = :rid, task_context = :ctx, updated_at = now()
                """,
                sid=session_id,
                rid=run_id,
                ctx=json.dumps(task_context),
            )
        finally:
            conn.close()
    except Exception:
        log.exception("update_task_context: failed to persist agent_state for session_id=%s", session_id)


# ---------------------------------------------------------------------
# READ: semantic recall, used BEFORE the agents run so their prompts can
# be given real prior context instead of starting cold every time.
# ---------------------------------------------------------------------
def recall_context(origin: str, destinations: List[str], query_text: str, k: int = 3) -> List[str]:
    """Return up to `k` prior memory snippets for this route, ranked by
    vector similarity to query_text. Empty list on any failure or if no
    memories exist yet - callers should treat this as optional context,
    never a hard dependency."""
    try:
        route_key = _route_key(origin, destinations)
        conn = get_conn()
        try:
            rows = conn.run(
                """
                SELECT content FROM memories
                WHERE route_key = :rk
                ORDER BY embedding <-> :emb::VECTOR(384)
                LIMIT :k
                """,
                rk=route_key,
                emb=_vector_literal(embed(query_text)),
                k=k,
            )
        finally:
            conn.close()
        return [r[0] for r in rows]
    except Exception:
        log.exception("recall_context: failed to query memories")
        return []
