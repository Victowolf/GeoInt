-- Run this once in the CockroachDB SQL Shell (or via
-- `cockroach sql --url "<connection-string>" -f schema.sql`)
-- before the app writes anything.

CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,              -- links back to shipment_runs.id
  agent_name STRING NOT NULL,        -- "agent1" | "agent2" | "agent3" | "agent4" | "agent5"
  route_key STRING NOT NULL,         -- normalized "origin|dest1|dest2..." for pre-filtering
  content STRING NOT NULL,           -- the actual takeaway text that was embedded
  embedding VECTOR(384) NOT NULL,    -- fastembed / BAAI/bge-small-en-v1.5 output
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE VECTOR INDEX IF NOT EXISTS memories_embedding_idx ON memories (embedding);
CREATE INDEX IF NOT EXISTS memories_route_key_idx ON memories (route_key);

CREATE TABLE IF NOT EXISTS shipment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  origin STRING,
  destinations STRING[],
  sector STRING,
  intent STRING,
  commodity_name STRING,
  budget STRING,
  risk_score FLOAT8,
  suggestion STRING,                 -- Agent 4's final verdict
  request_json JSONB NOT NULL,       -- full OrchestratorInput, unmodified
  response_json JSONB NOT NULL,      -- full OrchestratorOutput, unmodified
  errors JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shipment_runs_session_idx ON shipment_runs (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_state (
  session_id UUID PRIMARY KEY,   -- PRIMARY KEY doubles as the UNIQUE constraint ON CONFLICT needs
  last_run_id UUID,
  task_context JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- NOTE: this table was previously defined but never written to. As of
-- memory.py's get_task_context()/update_task_context() + orchestrator.py's
-- session_id wiring, it's now actively read before and written after every
-- orchestrator call that includes a session_id - see memory.py comments.

-- Quick sanity check after your first orchestrator run:
--   SELECT id, origin, suggestion, created_at FROM shipment_runs ORDER BY created_at DESC LIMIT 5;
--   SELECT agent_name, content FROM memories ORDER BY created_at DESC LIMIT 10;
