"""
routes.py
All HTTP routes in one place. Each route is a thin wrapper that validates
input via models.py, calls the matching agent, and returns its output.

Note: the /orchestrator/run route rarely raises on its own now — individual
agent failures are caught inside run_orchestration() and reported in the
response's `errors` field instead of a 500, so a dashboard frontend can
still render whatever succeeded. The try/except here still guards against
anything unexpected (e.g. a bug outside the per-agent try/except).
"""
import logging

from fastapi import APIRouter, HTTPException
from models import (
    Agent1Input, Agent1Output, Agent2Input, Agent2Output,
    Agent3Input, Agent3Output, Agent4Input, Agent4Output,
    Agent5Input, Agent5Output, OrchestratorInput, OrchestratorOutput,
)
from agent1 import run_agent1
from agent2 import run_agent2
from agent3 import run_agent3
from agent4 import run_agent4
from agent5 import run_agent5
from orchestrator import run_orchestration

log = logging.getLogger("sentinel.routes")
router = APIRouter()


@router.post("/agent1/geopolitical-intelligence", response_model=Agent1Output, tags=["Agent 1"])
def geopolitical_intelligence(data: Agent1Input):
    try:
        return run_agent1(data)
    except Exception as e:
        log.exception("agent1 route failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent2/future-scenario", response_model=Agent2Output, tags=["Agent 2"])
def future_scenario(data: Agent2Input):
    try:
        return run_agent2(data)
    except Exception as e:
        log.exception("agent2 route failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent3/route-optimization", response_model=Agent3Output, tags=["Agent 3"])
def route_optimization(data: Agent3Input):
    try:
        return run_agent3(data)
    except Exception as e:
        log.exception("agent3 route failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent4/decision-advisor", response_model=Agent4Output, tags=["Agent 4"])
def decision_advisor(data: Agent4Input):
    try:
        return run_agent4(data)
    except Exception as e:
        log.exception("agent4 route failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent5/procurement-advisor", response_model=Agent5Output, tags=["Agent 5"])
def procurement_advisor(data: Agent5Input):
    try:
        return run_agent5(data)
    except Exception as e:
        log.exception("agent5 route failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orchestrator/run", response_model=OrchestratorOutput, tags=["Orchestrator"])
async def orchestrator_run(data: OrchestratorInput):
    try:
        return await run_orchestration(data)
    except Exception as e:
        log.exception("orchestrator route failed")
        raise HTTPException(status_code=500, detail=str(e))