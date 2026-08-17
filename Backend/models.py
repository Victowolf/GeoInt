"""
models.py
Single source of truth for every request/response schema used by the agents.
Keeping all schemas here means routes.py and the agent files stay clean.

Route convention: every route is described as `origin` (the starting point)
plus `destinations` (the ordered stops after the origin, ending at the final
delivery point). `mandatory_checkpoints` aligns 1:1 with `destinations` only
(the origin is always the start, so it doesn't need a checkpoint flag).

Changelog (THIS revision - memory recall wiring):
- Agent1Input, Agent2Input, Agent5Input each gained `prior_context: str`.
  This is populated by orchestrator.py from memory.recall_context() BEFORE
  the agent runs, using CockroachDB's vector-indexed `memories` table.
  Previously memory was write-only (stored after every run, never read
  back) - this is what makes it read-back into agent reasoning, which is
  the difference between "toy" memory and memory that actually changes
  agent behavior.
- OrchestratorInput gained an optional `session_id`. When provided, the
  orchestrator looks up that session's `agent_state.task_context` in
  CockroachDB (multi-turn continuity - e.g. "you previously asked about
  this route with a $250k budget") and writes an updated task_context back
  after the run. Previously `agent_state` was defined in the schema but
  never actually read or written by any code path.
- Added TaskContext model - the shape stored in agent_state.task_context.

(Earlier changelog entries - Agent1-5 field additions from the original
build - are unchanged from the previous version and omitted here for
brevity; see git history / prior README for that context.)
"""
from pydantic import BaseModel, field_validator, model_validator
from typing import List, Optional, Dict
from enum import Enum


# ---------- Shared enums ----------
class Transport(str, Enum):
    waterways = "Waterways"
    airways = "Airways"
    road = "Road"
    rail = "Rail"
    mixed = "Mixed Transport"


class Sector(str, Enum):
    energy = "Energy"
    commercial_goods = "Commercial Goods"
    agriculture = "Agriculture"
    minerals = "Minerals"
    humanitarian_aid = "Humanitarian Aid"
    others = "Others"


class Intent(str, Enum):
    buy = "Buy"
    sell = "Sell"
    transport = "Transport"


class Status(str, Enum):
    safe = "safe"
    tension = "tension"
    unsafe = "unsafe"


class Suggestion(str, Enum):
    proceed = "Proceed"
    caution = "Caution"
    wait = "Wait"
    use_alternate_route = "Use Alternate Route"


# ---------- Shared: coordinates ----------
class Coordinates(BaseModel):
    """Populated by geocode.py after the LLM responds - never trust the
    model to produce accurate lat/lon itself."""
    lat: Optional[float] = None
    lon: Optional[float] = None


# ---------- Shared: agent_state task context ----------
class TaskContext(BaseModel):
    """Shape of agent_state.task_context (JSONB). Tracks what's changed
    across repeated calls in the same session_id, so a returning user's
    2nd/3rd call can reference "last time you asked about this route at
    $X budget" instead of treating every call as a stranger. Kept
    deliberately small/flat - this is session continuity, not a full
    conversation transcript (that's what `memories` + `shipment_runs`
    already cover)."""
    last_origin: str = ""
    last_destinations: List[str] = []
    last_budget: str = ""
    last_suggestion: str = ""     # Agent 4's last verdict for this session
    call_count: int = 0


# ---------- Helper: checkpoint/destination length validation ----------
def _validate_checkpoints_match_destinations(destinations: List[str], mandatory_checkpoints: List[int]):
    if len(mandatory_checkpoints) != len(destinations):
        raise ValueError(
            f"mandatory_checkpoints (len={len(mandatory_checkpoints)}) must have exactly one entry "
            f"per destination (len={len(destinations)}); a mismatch here silently misaligns the "
            f"checkpoint flags when the LLM prompt zips them together."
        )


# ---------- Agent 1: Geopolitical Intelligence ----------
class Agent1Input(BaseModel):
    origin: str
    destinations: List[str]
    preferred_transport: Transport
    sector: Sector  # informs risk framing (e.g. humanitarian corridors vs. chokepoint sensitivity)
    # Populated by orchestrator.py from memory.recall_context() BEFORE this
    # agent runs - prior findings on this same route, pulled from
    # CockroachDB's vector-indexed `memories` table. Empty on a route's
    # first-ever run. This is what makes memory actually change model
    # behavior, not just get logged after the fact.
    prior_context: str = ""


class Source(BaseModel):
    url: str = ""
    content: str = ""  # plain-language explanation of the situation at this stop, grounded in the cited source
    coordinates: Coordinates = Coordinates()


class DestinationStatus(BaseModel):
    destination: str
    present_status: Status
    source: Source


class Consolidated1(BaseModel):
    risk_score: float
    simple_summary: str = ""  # plain-language, non-expert explanation of overall route risk


class Agent1Output(BaseModel):
    # Covers the full route: origin first, then each destination in order.
    destinations: List[DestinationStatus]
    consolidated: Consolidated1


# ---------- Agent 2: Future Scenario Simulator ----------
class Agent2Input(BaseModel):
    origin: str
    destinations: List[str]
    preferred_transport: Transport
    budget: str = ""
    sector: Optional[Sector] = None
    intent: Optional[Intent] = None
    commodity_name: str = ""
    quantity: str = ""
    expected_price: str = ""
    # See Agent1Input.prior_context - same mechanism, applied to Agent 2's
    # supply-chain reasoning (e.g. "last time, congestion at this port was
    # the dominant risk - check if that has changed").
    prior_context: str = ""


class CostImpact(BaseModel):
    value: float  # fraction, e.g. 0.12 for 12% - kept for backward compatibility
    type: str     # "reduction" | "increase"

    @field_validator("value")
    @classmethod
    def _value_must_be_a_plausible_fraction(cls, v: float) -> float:
        if not (0.0 <= v <= 5.0):
            raise ValueError(
                f"cost_impact.value must be a fraction between 0.0 and 5.0 (e.g. 0.12 for a "
                f"12% impact) - got {v}, which looks like a raw number or percentage rather "
                f"than a fraction"
            )
        return v


class Scenario(BaseModel):
    scenario_name: str
    scenario_description: str
    affected_stop: str
    scenario_probability: float
    estimated_delays: str
    cost_impact: CostImpact
    estimated_cost_impact_amount: str = ""
    plain_language_note: str = ""


class Consolidated2(BaseModel):
    supply_chain_analysis: str
    estimated_production_yield: str = ""
    demand_supply_gap: str = ""
    simple_summary: str = ""


class Agent2Output(BaseModel):
    scenarios: List[Scenario]
    consolidated: Consolidated2


# ---------- Agent 3: Route Optimization ----------
class Agent3Input(BaseModel):
    origin: str
    destinations: List[str]
    mandatory_checkpoints: List[int]
    preferred_transport: Transport
    budget: str
    maximum_duration: str

    @model_validator(mode="after")
    def _checkpoints_match_destinations(self):
        _validate_checkpoints_match_destinations(self.destinations, self.mandatory_checkpoints)
        return self


class AltRoute(BaseModel):
    origin: str
    destinations: List[str]
    mandatory_checkpoints: List[int]
    risk_score: float
    estimated_cost: str
    estimated_duration: str
    explanation: str = ""


class Consolidated3(BaseModel):
    simple_summary: str
    recommended_route_index: int = 0
    glossary: Dict[str, str] = {}


class Agent3Output(BaseModel):
    alternative_routes: List[AltRoute]
    consolidated: Consolidated3


# ---------- Agent 4: Decision Advisor ----------
class Agent4Agent1(BaseModel):
    risk_score: float
    destinations: List[DestinationStatus]


class Agent4Agent2(BaseModel):
    supply_chain_analysis: str


class Agent4Agent3(BaseModel):
    least_risk_route: AltRoute


class Agent4Input(BaseModel):
    agent1: Agent4Agent1
    agent2: Agent4Agent2
    agent3: Agent4Agent3


class Agent4Output(BaseModel):
    suggestion: Suggestion
    wait_duration: Optional[str] = None
    confidence: float
    reason: List[str]
    factors: List[str]

    @model_validator(mode="after")
    def _wait_duration_requires_wait_suggestion(self):
        if self.suggestion == Suggestion.wait and not self.wait_duration:
            raise ValueError("wait_duration must be set when suggestion is 'Wait'")
        return self


# ---------- Agent 5: Procurement Advisor ----------
class Agent5Input(BaseModel):
    origin: str
    destinations: List[str]
    mandatory_checkpoints: List[int]
    preferred_transport: Transport
    budget: str
    maximum_duration: str
    sector: Sector
    intent: Intent
    commodity_name: str
    quantity: str
    expected_price: str
    # See Agent1Input.prior_context - same mechanism, applied to Agent 5's
    # procurement/market reasoning.
    prior_context: str = ""

    @model_validator(mode="after")
    def _checkpoints_match_destinations(self):
        _validate_checkpoints_match_destinations(self.destinations, self.mandatory_checkpoints)
        return self


class ProcurementEntity(BaseModel):
    name: str
    reliability_note: str = ""
    source_url: str = ""


class Agent5Output(BaseModel):
    markets: List[ProcurementEntity]
    suppliers: List[ProcurementEntity]
    cost_diff: str
    estimated_savings: str
    savings_basis: str = ""
    import_export_restrictions: List[str]
    recommended_action: str = ""
    demand_assessment: str = ""
    risk_adjusted_note: str = ""

    @field_validator("cost_diff")
    @classmethod
    def _cost_diff_format(cls, v: str) -> str:
        import re
        if not re.fullmatch(r"\d+(\.\d+)?%\s(reduction|increase)", v.strip()):
            raise ValueError(
                'cost_diff must look like "9.7% reduction" or "12% increase" '
                '(no leading sign, no plain "-9.7%")'
            )
        return v.strip()


# ---------- Orchestrator (combines everything above) ----------
class OrchestratorInput(BaseModel):
    origin: str
    destinations: List[str]
    mandatory_checkpoints: List[int]
    preferred_transport: Transport
    budget: str
    maximum_duration: str
    sector: Sector
    intent: Intent
    commodity_name: str
    quantity: str
    expected_price: str
    # Optional. When provided, orchestrator.py looks up this session's
    # prior agent_state.task_context in CockroachDB before running (e.g.
    # "you previously assessed this route at a $250k budget") and writes
    # an updated task_context back afterward. Omit for a stateless
    # one-off call (e.g. from /docs testing) - everything still works,
    # you just don't get session continuity.
    session_id: Optional[str] = None

    @model_validator(mode="after")
    def _checkpoints_match_destinations(self):
        _validate_checkpoints_match_destinations(self.destinations, self.mandatory_checkpoints)
        return self


class OrchestratorOutput(BaseModel):
    agent1: Optional[Agent1Output] = None
    agent2: Optional[Agent2Output] = None
    agent3: Optional[Agent3Output] = None
    agent4: Optional[Agent4Output] = None
    agent5: Optional[Agent5Output] = None
    errors: Dict[str, str] = {}
    # Informational only - lets the frontend show "we remembered your last
    # session" without a separate call. None if no session_id was given or
    # this is the session's first-ever call.
    session_continuity_note: Optional[str] = None
