<div align="center">

# Sentinel

**AI powered supply chain risk and procurement intelligence, across every mode of transport**

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![CockroachDB](https://img.shields.io/badge/CockroachDB-6933FF?style=for-the-badge&logo=cockroachlabs&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazonaws&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-F55036?style=for-the-badge&logo=groq&logoColor=white)

</div>

# Sentinel

**AI powered supply chain risk and procurement intelligence, across every mode of transport**

Sentinel is a multi agent backend that checks a shipment before it moves. You give it an origin, a set of destinations, a budget, a commodity, and a mode of transport, and it comes back with a full risk picture and a procurement recommendation, built by five agents working together instead of one model trying to do everything at once.

It works across every mode of transport, sea, air, road, and rail, not just shipping routes. A trade route that mixes trucking and air freight gets looked at with the same depth as a purely maritime one.

---

## Index

- [Problem Understanding](#problem-understanding)
- [Overall Solution Features](#overall-solution-features)
- [Architecture](#architecture)
- [AWS and CockroachDB Integration](#aws-and-cockroachdb-integration)
- [Results and Validation](#results-and-validation)
- [Running the Project](#running-the-project)
- [Closing Note](#closing-note)

---

## Problem Understanding

Most supply chain shocks are visible long before they show up in prices. A port closes, a sanction gets announced, a storm forms near a shipping lane, but by the time this turns into a headline or a price spike, it is usually 36 to 48 hours after the first real signals appeared. By then, a shipment already in transit has already absorbed the cost of the disruption, whether that means a delay, a rerouted path, or a supplier who suddenly cannot deliver.

For a procurement or logistics team, this delay is expensive in two different ways. First, they find out too late to change course, which turns a manageable risk into an emergency. Second, even when they do find out early, the information usually comes from scattered sources, a news article here, a sanctions update there, a weather alert somewhere else, none of which are connected to each other or to the actual shipment sitting on their desk. Reading five different signals and turning them into one clear decision is a slow, manual process, and it does not scale when a team is managing many routes at once.

There is a second problem underneath the first one. Most tools built for this space think of supply chains as shipping problems, watching ports and vessels and little else. Real trade does not work that way. A single shipment might start on a truck, move onto a ship to cross a chokepoint, and finish its journey by rail. A tool that only watches maritime routes is only solving part of the problem, and it leaves entire categories of risk, like a border closure or a rail strike, completely invisible.

Sentinel was built to close both gaps at once. It watches real signals as they happen, across every transport mode, and instead of handing back a pile of disconnected data points, it turns them into one clear, explainable decision that a procurement team can actually act on the same day they receive it.

## Overall Solution Features

Sentinel is built around five specialized agents, each with one clear job, plus an orchestrator that decides the order they run in and ties their outputs together.

**1. Geopolitical Intelligence Agent.** This agent checks the current situation at every stop on the route using live web search, and returns a plain status for each destination, safe, tension, or unsafe, along with the source behind that verdict and an overall route risk score. Because this is the agent whose output is meant to be shown on a map, its findings also get resolved into real coordinates through a separate geocoding step rather than asking the language model to guess latitude and longitude, since that is not something a model can be trusted to produce accurately on its own.

**2. Future Scenario Simulator.** This agent projects two to three realistic disruption scenarios for the route, things like a closure, an export ban, or an escalating conflict, and estimates a probability and a delay for each one. Rather than trusting the model to also generate a matching dollar figure, the model is only asked for a percentage, such as twelve percent, and that percentage is then multiplied against the shipment's actual stated budget in plain code. This avoids a common failure mode where a language model produces two numbers, a percentage and a dollar amount, that quietly do not agree with each other.

**3. Route Optimization Agent.** This agent proposes alternative routes that still respect mandatory checkpoints, the given budget, and the delivery timeline, and explains in plain language why each option is cheaper, safer, or slower than the others. It does not need live web search to do this job, since it is reasoning over constraints that are already known rather than looking something up, which also keeps it off the shared search rate limit and makes it considerably cheaper to run.

**4. Decision Advisor.** This agent reads the combined output of the first three agents and writes one final verdict, Proceed, Caution, Wait, or Use Alternate Route, along with the reasoning and factors behind that call. It is deliberately prompted to write as a single analyst making one decision, not as a summary of three separate systems. The actual choice of which alternate route counts as the safest one is made deterministically in code, by taking the lowest risk score from the route optimization agent's output, so the model is only ever writing the narrative around a decision that logic has already made, not making the decision itself.

**5. Procurement Advisor.** This agent recommends better markets and suppliers for the commodity being moved, with advice that changes depending on whether the goal is to buy, sell, or transport. Its estimated savings figure is recalculated in plain code against the real order value rather than trusted directly from the model's own text, for the same reason the cost impact figures in agent two are recalculated rather than trusted outright.

**How they fit together.** Agents one, two, three, and five all run at the same time, since none of them need each other's output to do their job. Agent four is the only one that waits, since it needs the combined results of the first three agents before it can make a final call, and it is skipped entirely if any of those three failed, rather than letting it reason over incomplete information. A small extra step also connects agent five's advice to agent one's real, already computed risk score once both are done, so the procurement recommendation and the geopolitical risk assessment never quietly disagree with each other.

**Memory that actually gets used.** On top of the five agents, Sentinel remembers. Every past run is stored, and relevant pieces of it are pulled back into the next request on a similar route before the agents even start reasoning, so the system gets sharper and faster the more it is used, rather than starting from a blank page every single time. This memory layer is explained in full detail in the next section.

<div align="center">
<img src="https://raw.githubusercontent.com/Victowolf/GeoInt/main/assests/solution-overview.png" alt="Sentinel solution overview" width="800"/>
</div>

## Architecture

The full breakdown of how each agent works internally, step by step, along with the complete CockroachDB schema and design reasoning, is documented separately with a dedicated flowchart for every agent. You can explore the complete architecture here:

**[ARCHITECTURE.md](https://github.com/Victowolf/GeoInt/blob/main/Backend/ARCHITECTURE.md)**

That document walks through the full orchestration flow from the moment a request comes in to the moment a response goes out, plus a separate flowchart for each of the five agents, so the exact path any given request takes through the system is easy to trace and easy to explain to someone seeing it for the first time.

## AWS and CockroachDB Integration

### CockroachDB, the memory layer

Sentinel does not treat memory as an afterthought bolted on at the end. Three tables carry the entire persistence layer, and each one is doing a genuinely different job rather than three tables that all just store the same kind of thing.

**The `memories` table** stores a piece of takeaway text from each agent, turned into a 384 dimension vector using a small local embedding model, `BAAI/bge-small-en-v1.5`, that runs inside the same process through fastembed. This matters because it means no external embedding API is called and no extra cost is incurred per embedding, since nothing leaves the application to generate it.

Before the agents run on a new request, the system searches this table for the same route using a two step approach. It first filters rows down to an exact route key, a normalized string built from the origin and destination list, and only then ranks what remains by vector distance against the current request. This ordering matters more than it looks like it would. A vector search run on its own, without the route filter first, could easily surface a memory from a completely unrelated shipment that just happens to use similar wording, which would actively hurt the quality of the next decision rather than help it. Filtering by route first, then searching by meaning inside that smaller set, is what keeps the recalled context actually relevant to the request in front of it.

```sql
SELECT content FROM memories
WHERE route_key = $1
ORDER BY embedding <-> $2
LIMIT 3;
```

A vector index sits directly on top of this table, so this ranking does not require scanning every row to compute distance one by one. As the table grows across many runs, in a demo or in a real deployment across many shipments, the index keeps this query fast instead of getting slower the more the system gets used, which is the entire point of using a database with native distributed vector support rather than holding embeddings in memory or wiring up a separate vector database that would need to be kept in sync by hand.

The recalled snippets get fed back into agents one, two, and five as prior findings, along with an explicit instruction to verify rather than blindly trust them, since real conditions on a shipping route can change between one call and the next. This is the detail that makes it real memory rather than just a log. A record that gets written but never read back into a decision is just storage sitting quietly in a table. A record that changes what the very next decision actually considers is memory in the sense that matters for an agent.

**The `shipment_runs` table** stores the complete input and complete output of every orchestrator call as JSONB, with nothing summarized or dropped, so any past run can be replayed and audited exactly as it happened. A handful of fields, like the overall risk score and the final suggestion, are also pulled out into their own columns purely so a dashboard or a reviewer can filter and sort quickly without needing to parse JSONB on every single row.

**The `agent_state` table** tracks continuity across repeated calls from the same session. When a request includes a session id, its stored context, holding the last known origin, destinations, budget, and verdict, is read before the agents run and written back afterward using a single atomic upsert. This is what lets a second call in the same session pick up naturally from the first one, for example noticing that a client asked about the same route with a different budget than before, without needing to rerun a vector search just to reconstruct that context from scratch.

**Failure handling.** Every read and every write to CockroachDB is wrapped so that a database issue never breaks a response that has already been computed for the user. If a recall fails, the system simply returns an empty context and moves on. If a write fails, it gets logged and skipped rather than raised as an error. The system is deliberately designed so that losing the CockroachDB connection degrades Sentinel to a stateless, single request tool for that moment, not to a broken one.

### AWS, where it runs

Sentinel is packaged to deploy as a single AWS Lambda function. The same FastAPI application that runs locally with uvicorn during development runs inside Lambda through Mangum, a small adapter that lets a standard FastAPI app handle Lambda's event format without any changes to the actual application code. It is exposed directly through a Lambda Function URL, so no separate API Gateway configuration is needed just to get a working public endpoint.

This matters more than it might seem to at first. Nothing about the application logic changes between running it locally and running it deployed, only the entrypoint changes. That means whatever gets tested on a local machine during development is exactly what runs in production, with no separate deployment specific code path that could behave differently or hide a bug that only shows up once it is live.

<div align="center">
<img src="https://raw.githubusercontent.com/Victowolf/GeoInt/main/assests/architecture-flow.png" alt="Sentinel architecture flow" width="800"/>
</div>

## Results and Validation

Sentinel's approach was checked against a real historical event, the January 2022 Indonesia coal export ban, as a way to see whether the system's underlying logic actually holds up against something that really happened, rather than only against a simulated or hypothetical scenario.

| Metric | Result |
|---|---|
| Detection lead time | Flagged around 6 hours after the earliest export ban signals appeared, compared to roughly 36 to 48 hours for the broader market to visibly react |
| Price forecast | Predicted an 18 to 22 percent spike, the actual benchmark spike was close to 20 percent |
| Recommended action | Suggested shifting to Australian or South African coal, which matches what buyers actually did in the following weeks |

Beyond that single case, a wider back test was run across 20 historical disruption events. Across that set, the system averaged a 28 hour earlier detection lead time compared to visible market reaction, a 9.4 percent mean absolute error on its price forecasts, 90 percent directional accuracy on whether prices would rise or fall, and an average end to end response time of about 4.2 hours from the first signal appearing to a final recommendation being ready.

This back test is meant as an illustrative check on the approach and the reasoning behind it, not as a claim about live production performance under real operating conditions.

## Running the Project

### Backend

Start by setting up a Python environment and installing dependencies.

```bash
python -m venv venv
source venv/bin/activate        # on Windows use venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Open the newly created `.env` file and fill in your Groq API key along with your CockroachDB connection details. Once that is done, run the schema once against your CockroachDB cluster to create the three tables described above.

```bash
psql "postgresql://<user>:<password>@<host>:26257/<db>?sslmode=verify-full" -f schema.sql
```

With the environment configured and the schema in place, start the backend.

```bash
uvicorn main:app --reload
```

The interactive API docs will be available at `http://127.0.0.1:8000/docs`, where every endpoint, including each individual agent and the combined orchestrator route, can be tried directly against your running server.

### Frontend

From the frontend project folder, install dependencies and start the development server.

```bash
npm i
npm run dev
```

Open `http://localhost:5173` in your browser once the dev server has started. The app reloads automatically as changes are made, so the dashboard stays in sync with the backend as you work.

## Closing Note

Sentinel is built to keep growing rather than stay fixed at what it does today. The agents, the CockroachDB memory layer, and the frontend dashboard are all separate enough that any one of them can improve on its own, whether that means adding deeper modeling for a specific transport mode, growing the historical dataset the system learns from, or wiring in new data sources to ground its decisions even more firmly in what is actually happening in the world.
