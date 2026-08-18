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

> To show your own project logo above this text instead of just the name, save your logo image inside the `assests` folder in your repo, for example `assests/logo.png`, then add this line right above the badges:
> ```markdown
> <img src="https://raw.githubusercontent.com/Victowolf/GeoInt/main/assests/logo.png" alt="Sentinel logo" width="140"/>
> ```

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

Sentinel is a multi agent backend that checks a shipment before it moves. You give it an origin, a set of destinations, a budget, a commodity, and a mode of transport, and it comes back with a full risk picture and a procurement recommendation, built by five agents working together instead of one model trying to do everything at once.

It works across every mode of transport, sea, air, road, and rail, not just shipping routes. A trade route that mixes trucking and air freight gets looked at with the same depth as a purely maritime one.

## Problem Understanding

Most supply chain shocks are visible long before they show up in prices. A port closes, a sanction gets announced, a storm forms near a shipping lane, but by the time this turns into a headline or a price spike, it is usually 36 to 48 hours after the first real signals appeared. For a team moving goods across borders, that gap is expensive. They either find out too late or they find out from a source that is not detailed enough to act on.

There is also a second problem. Most tools built for this space only think in terms of ships and ports. Real trade does not work that way. A single shipment might go by truck to a port, by sea across a chokepoint, and then by rail to its final destination. A tool that only watches maritime routes is only solving part of the problem.

Sentinel was built to close both gaps. It watches real signals as they happen, across every transport mode, and turns them into a decision a procurement team can actually act on, not just a risk score to look at.

## Overall Solution Features

Sentinel is built around five specialized agents, each doing one clear job:

1. Geopolitical Intelligence Agent checks the current situation at every stop on the route using live web search and returns a plain status per stop, safe, tension, or unsafe, along with an overall route risk score.
2. Future Scenario Simulator projects likely disruptions such as closures, bans, or escalating conflict, and turns each one into a real cost figure measured against the shipment's actual budget.
3. Route Optimization Agent proposes alternative routes that still respect mandatory checkpoints, budget, and delivery time, and explains why each option is cheaper, safer, or slower.
4. Decision Advisor reads the combined output of the first three agents and gives one final call, Proceed, Caution, Wait, or Use Alternate Route.
5. Procurement Advisor recommends better markets and suppliers for the commodity being moved, with advice that changes depending on whether the goal is to buy, sell, or transport.

Agents one, two, three, and five run at the same time since none of them depend on each other. Agent four waits until the first three are done, since it needs their combined output to make a final call. A small deterministic step also ties agent five's advice back to agent one's real computed risk score in plain code, rather than asking a model to reason about a number that already exists somewhere else in the pipeline. This keeps the final output consistent instead of having two agents quietly disagree with each other.

On top of the agents, Sentinel remembers. Every past run is stored, and relevant pieces of it are pulled back in the next time a similar route comes up, so the system gets more useful the more it is used instead of starting from zero every single time.

<div align="center">
<img src="https://raw.githubusercontent.com/Victowolf/GeoInt/main/assests/solution-overview.png" alt="Sentinel solution overview" width="800"/>
</div>

## Architecture

The full breakdown of how each agent works internally, along with the detailed CockroachDB design, is documented separately with diagrams for every step. You can explore the complete architecture here:

**[ARCHITECTURE.md](https://github.com/Victowolf/GeoInt/blob/main/Backend/ARCHITECTURE.md)**

That document covers the full orchestration flow and a dedicated flowchart for each of the five agents, so the exact path a request takes through the system is easy to follow.

## AWS and CockroachDB Integration

### CockroachDB, the memory layer

Sentinel does not treat memory as an afterthought. Three tables carry the entire persistence layer, and each one does a different job.

The first table, `memories`, stores a piece of takeaway text from each agent, turned into a 384 dimension vector using a small local embedding model that runs inside the same process, so there is no extra API call or extra cost per embedding. Before the agents run on a new request, the system searches this table for the same route, first filtering by an exact route key, then ranking what is left by vector similarity. This two step approach matters because a vector search on its own could easily pull in a memory from a completely different shipment that just happens to use similar words. Filtering by route first keeps what gets recalled actually relevant. A vector index sits on top of this table so the search stays fast even as the table grows across many runs, instead of getting slower the more the system is used.

The recalled context gets fed back into agents one, two, and five as prior findings, along with an instruction to verify rather than blindly trust it, since real conditions on a route can change between calls. This is what makes it real memory rather than just a log. A record that never gets read back into a decision is just storage. A record that changes what the next decision considers is memory in the way that actually matters for an agent.

The second table, `shipment_runs`, stores the complete input and complete output of every run as JSONB, so any past decision can be replayed and audited exactly as it happened, with a few key fields like risk score and final suggestion pulled out separately for fast filtering.

The third table, `agent_state`, tracks continuity across repeated calls from the same session, so a returning client gets their last known budget and verdict back before the agents even run again.

Every read and every write to CockroachDB is wrapped so a database issue never breaks the response already computed for the user. If a recall fails, the system just returns an empty context. If a write fails, it gets logged and skipped. Losing the database connection turns Sentinel into a stateless tool for that moment, not a broken one.

### AWS, where it runs

Sentinel is packaged to deploy as a single AWS Lambda function. The same FastAPI application that runs locally with uvicorn runs in Lambda through Mangum, a small adapter that lets a standard FastAPI app handle Lambda events without any code changes. It is exposed through a Lambda Function URL directly, so no separate API Gateway setup is needed to get a public endpoint working.

Nothing about the actual application code changes between running it locally and running it deployed. Only the entrypoint changes, which keeps local development and production behavior identical, so what gets tested locally is exactly what runs live.

<div align="center">
<img src="https://raw.githubusercontent.com/Victowolf/GeoInt/main/assests/architecture-flow.png" alt="Sentinel architecture flow" width="800"/>
</div>

## Results and Validation

Sentinel's approach was checked against a real historical event, the January 2022 Indonesia coal export ban, as a way to see whether the system's logic actually holds up against something that really happened rather than just a simulated scenario.

| Metric | Result |
|---|---|
| Detection lead time | Flagged around 6 hours after the earliest export ban signals appeared, compared to roughly 36 to 48 hours for the market to visibly react |
| Price forecast | Predicted an 18 to 22 percent spike, the actual benchmark spike was close to 20 percent |
| Recommended action | Suggested shifting to Australian or South African coal, which matches what buyers actually did in the following weeks |

Across a wider back test of 20 historical disruption events, the system averaged a 28 hour earlier detection lead time compared to visible market reaction, a 9.4 percent mean absolute error on its price forecasts, 90 percent directional accuracy on whether prices would rise or fall, and an average end to end response time of about 4.2 hours from first signal to final recommendation.

This is meant as an illustrative check on the approach, not a claim about live production performance.

## Running the Project

### Backend

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in your Groq API key and your CockroachDB connection details inside `.env`, then run the schema once against your cluster.

```bash
psql "postgresql://<user>:<password>@<host>:26257/<db>?sslmode=verify-full" -f schema.sql
```

Start the backend.

```bash
uvicorn main:app --reload
```

The interactive API docs will be available at `http://127.0.0.1:8000/docs`, where every endpoint can be tested directly.

### Frontend

```bash
npm i
npm run dev
```

Open `http://localhost:5173` in your browser once the dev server starts. The app reloads automatically as changes are made.

## Closing Note

Sentinel is built to keep growing. The agents, the CockroachDB memory layer, and the frontend dashboard are all separate enough that any one of them can improve on its own, whether that means adding new transport modes, growing the historical data the system learns from, or adding new data sources to ground its decisions in reality.
