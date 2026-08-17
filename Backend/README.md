# Sentinel

Sentinel is a multi agent backend that evaluates a shipment before it moves. Give it an origin, a set of destinations, a budget, a commodity, and a transport mode, and it returns a full risk and procurement picture built from five specialized agents running in parallel, plus one final decision agent that reads their combined output.

The system is built on FastAPI, uses Groq hosted language models for reasoning, and uses CockroachDB as its memory layer for both structured audit history and vector based semantic recall. It is packaged to run locally with uvicorn and to deploy as a single AWS Lambda function behind a public Function URL.

For a detailed breakdown of each agent's internal flow and a full explanation of how CockroachDB is used, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## What the five agents do

1. Geopolitical Intelligence Agent. Checks the current situation at every stop on the route using live web search, and returns a plain language risk status per stop plus an overall route risk score.
2. Future Scenario Simulator. Projects likely disruptions such as closures, bans, or conflict escalation, and turns each scenario's probability into a real cost figure against the shipment's stated budget.
3. Route Optimization Agent. Proposes alternative routes that respect mandatory checkpoints, budget, and delivery time, and explains why each alternative is cheaper, safer, or slower than the others.
4. Decision Advisor. Reads the combined output of agents one through three and issues a single final verdict: Proceed, Caution, Wait, or Use Alternate Route.
5. Procurement Advisor. Suggests better markets and suppliers for the commodity being moved, with guidance that changes depending on whether the intent is to buy, sell, or transport.

Agents one, two, three, and five run concurrently because none of them depend on each other's output. Agent four runs afterward because it needs all three of agents one through three to finish first. Agent five does not wait on agent four, but once both agent one and agent five are done, a small deterministic Python step ties agent five's advice to agent one's actual computed risk score, rather than asking a model to reason about a number that already exists elsewhere in the pipeline.

## CockroachDB in short

Every orchestrator run is written to CockroachDB as one row containing the full request and full response in JSONB, so any past run can be replayed or audited exactly as it happened. Each agent's human readable takeaway is also embedded into a 384 dimension vector and stored in a vector indexed table, so the next request on the same route can recall what was found before instead of starting from zero. A third table tracks session state across repeated calls from the same client, so a returning session gets its last known budget and verdict back before the agents even run. The full explanation, including the exact schema and why the vector index is defined the way it is, lives in ARCHITECTURE.md.

## Running locally

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Copy the example environment file and fill in your own values.

```bash
cp .env.example .env
```

You need at minimum a Groq API key and a CockroachDB connection. Create the CockroachDB Serverless cluster from the Cloud Console if you do not have one yet, then run the schema once against it.

```bash
psql "postgresql://<user>:<password>@<host>:26257/<db>?sslmode=verify-full" -f schema.sql
```

If you prefer the CockroachDB CLI instead of psql, download it directly from Cockroach Labs rather than relying on any binary bundled in this repository.

Start the API.

```bash
uvicorn main:app --reload
```

Open `http://127.0.0.1:8000/docs` for the interactive Swagger UI, where every endpoint below can be tried directly against your running server.

## Deploying to AWS

The app already wraps itself for Lambda. `main.py` exposes `handler = Mangum(app)`, `template.yaml` defines the function and a public Function URL as infrastructure as code, and `build_lambda_package.ps1` builds the deployable zip. Full step by step instructions, including a manual console path if you do not want to install the AWS SAM CLI, are in [DEPLOY.md](./DEPLOY.md).

In short, the deployed architecture is a single Lambda function running the same FastAPI app through Mangum, exposed through a Lambda Function URL so no API Gateway is required, with the same CockroachDB cluster and Groq keys passed in as environment variables. Nothing about the code changes between local and deployed. Only the entrypoint changes.

## API reference

All endpoints accept and return JSON. Every model referenced below is defined in `models.py`. Full request and response schemas, including every field, are also visible live at `/docs`.

### Health

`GET /`
Confirms the process is running. Does not touch CockroachDB.

`GET /health/deep`
Confirms the process is running and that CockroachDB is reachable, by running a single `SELECT 1`. Returns 503 with the underlying error if the database cannot be reached.

### Agent 1, Geopolitical Intelligence

`POST /agent1/geopolitical-intelligence`

Request body, `Agent1Input`: `origin`, `destinations` (list), `preferred_transport` (Waterways, Airways, Road, Rail, or Mixed Transport), `sector` (Energy, Commercial Goods, Agriculture, Minerals, Humanitarian Aid, or Others).

Response body, `Agent1Output`: a `destinations` list where each entry has a `present_status` (safe, tension, or unsafe) and a `source` with a URL, a plain language explanation, and resolved coordinates, plus a `consolidated` object with an overall `risk_score` and a `simple_summary`.

### Agent 2, Future Scenario Simulator

`POST /agent2/future-scenario`

Request body, `Agent2Input`: `origin`, `destinations`, `preferred_transport`, and optional context fields `budget`, `sector`, `intent`, `commodity_name`, `quantity`, `expected_price` that sharpen the cost and yield analysis when provided.

Response body, `Agent2Output`: a `scenarios` list where each entry describes the disruption, its probability, its estimated delay, and a `cost_impact` that is also converted into a real dollar figure against the given budget, plus a `consolidated` object with overall supply chain analysis, estimated production yield, demand versus supply gap, and a plain language summary.

### Agent 3, Route Optimization

`POST /agent3/route-optimization`

Request body, `Agent3Input`: `origin`, `destinations`, `mandatory_checkpoints` (a list of 0 or 1 flags, one entry per destination), `preferred_transport`, `budget`, `maximum_duration`.

Response body, `Agent3Output`: an `alternative_routes` list where each route has its own risk score, estimated cost, estimated duration, and a plain explanation of its tradeoffs, plus a `consolidated` object naming the recommended route and a glossary of any terms used.

### Agent 4, Decision Advisor

`POST /agent4/decision-advisor`

Request body, `Agent4Input`: the relevant slices of agent one, two, and three output, namely the risk score and destination statuses from agent one, the supply chain analysis from agent two, and the least risk route from agent three.

Response body, `Agent4Output`: a `suggestion` (Proceed, Caution, Wait, or Use Alternate Route), a `wait_duration` when the suggestion is Wait, a `confidence` score, and short `reason` and `factors` lists written as a single analyst's final call, not a summary of separate systems.

### Agent 5, Procurement Advisor

`POST /agent5/procurement-advisor`

Request body, `Agent5Input`: `origin`, `destinations`, `mandatory_checkpoints`, `preferred_transport`, `budget`, `maximum_duration`, `sector`, `intent` (Buy, Sell, or Transport), `commodity_name`, `quantity`, `expected_price`.

Response body, `Agent5Output`: `markets` and `suppliers` lists, a `cost_diff` string, an `estimated_savings` figure computed server side against the real order value rather than trusted from the model, `import_export_restrictions`, and intent aware `recommended_action` and `demand_assessment` fields.

### Orchestrator

`POST /orchestrator/run`

Request body, `OrchestratorInput`: everything needed across all five agents in one payload, namely `origin`, `destinations`, `mandatory_checkpoints`, `preferred_transport`, `budget`, `maximum_duration`, `sector`, `intent`, `commodity_name`, `quantity`, `expected_price`, and an optional `session_id`. When `session_id` is given, the orchestrator looks up that session's last known state in CockroachDB before running, and writes an updated state back afterward, so a second call in the same session carries continuity from the first.

Response body, `OrchestratorOutput`: `agent1` through `agent5` outputs, an `errors` object naming any agent that failed without taking down the whole request, and a `session_continuity_note` describing whether this session was recognized from a prior call.

This is the endpoint the demo frontend should call for the full experience. The individual agent endpoints exist mainly for testing a single agent in isolation.

## Environment variables

See `.env.example` for the complete list with comments. At minimum you need `GROQ_API_KEY` and the five `COCKROACH_*` values. Everything else has a sensible default.

## Project layout

```
Sentinel/
  main.py            FastAPI entrypoint, health checks, Lambda handler
  routes.py           All HTTP routes
  models.py            Every request and response schema
  orchestrator.py       Runs all five agents in dependency order, wires memory in and out
  agent1.py .. agent5.py  One file per agent, thin wrappers around a prompt and a model call
  prompts/                One prompt file per agent
  config.py                Groq client, model selection, and the token bucket rate limiter
  memory.py                 CockroachDB read and write layer, including embeddings and vector search
  advisory.py                Deterministic agent one to agent five risk enrichment, no model call
  money.py                     Free text money parsing and server side arithmetic
  geocode.py                    Place name to coordinates, used to plot agent one's findings on a map
  schema.sql                     CockroachDB schema, run once against a fresh cluster
  template.yaml                   AWS SAM template for the Lambda deployment
  build_lambda_package.ps1         Builds the Lambda deployment zip
  DEPLOY.md                         Full AWS deployment walkthrough
  ARCHITECTURE.md                    Per agent flowcharts and the CockroachDB design in detail
```

## A note on credentials

The version of this project that was originally exported for this submission had a `.env` file committed with real Groq keys and a real CockroachDB password, and that history is present in the original `.git` folder. This package removes that file and ships `.env.example` instead. Before making this repository public, generate fresh Groq keys, rotate the CockroachDB user's password from the Cloud Console, and start a new git history rather than pushing the old one, since old commits still contain the exposed values even after a file is deleted in a later commit.
