// lib/request.ts
// Mirrors backend/models.py exactly. Keep this in sync any time models.py changes —
// most of the frontend bugs we've hit so far trace back to this file drifting from
// the real API response shape.

export interface RequestData {
  origin: string;
  destinations: string[];
  mandatory_checkpoints: number[];
  preferred_transport: string; // "Waterways" | "Airways" | "Road" | "Rail" | "Mixed Transport"
  budget: string;
  maximum_duration: string;
  sector: string;
  intent: string;
  commodity_name: string;
  quantity: string;
  expected_price: string;
}

export const emptyRequest: RequestData = {
  origin: "",
  destinations: [""],
  mandatory_checkpoints: [0],
  preferred_transport: "",
  budget: "",
  maximum_duration: "",
  sector: "",
  intent: "",
  commodity_name: "",
  quantity: "",
  expected_price: "",
};

export type DestinationStatusValue = "safe" | "caution" | "danger";
export type Suggestion = "Proceed" | "Caution" | "Wait" | "Reconsider" | "Use Alternate Route";

export type AgentResponse = {
  agent1?: {
    destinations: Array<{
      destination: string;
      present_status: DestinationStatusValue;
      source: { url: string; content: string; coordinates: Record<string, unknown> };
    }>;
    consolidated: { risk_score: number; simple_summary: string };
  };
  agent2?: {
    scenarios: Array<{
      scenario_name: string;
      scenario_description: string;
      affected_stop: string;
      scenario_probability: number;
      estimated_delays: string;
      cost_impact: { value: number; type: string };
      estimated_cost_impact_amount: string;
      plain_language_note: string;
    }>;
    consolidated: {
      supply_chain_analysis: string;
      estimated_production_yield: string;
      demand_supply_gap: string;
      simple_summary: string;
    };
  };
  agent3?: {
    alternative_routes: Array<{
      origin: string;
      destinations: string[];
      mandatory_checkpoints: number[];
      risk_score: number;
      estimated_cost: string;
      estimated_duration: string;
      explanation: string;
    }>;
    consolidated: {
      simple_summary: string;
      recommended_route_index: number;
      glossary: Record<string, string>;
    };
  };
  agent4?: {
    suggestion: Suggestion;
    wait_duration: string;
    confidence: number;
    reason: string[];
    factors: string[];
  };
  agent5?: {
    markets: Array<{ name: string; reliability_note: string; source_url: string }>;
    suppliers: Array<{ name: string; reliability_note: string; source_url: string }>;
    cost_diff: string;
    estimated_savings: string;
    savings_basis: string;
    import_export_restrictions: string[];
    recommended_action: string;
    demand_assessment: string;
    risk_adjusted_note: string;
  };
  errors: Record<string, string>;
};

export interface DestinationStatus {
  destination: string;
  present_status: DestinationStatusValue;
  source: { url: string; content: string; coordinates: Record<string, unknown> };
}

export interface Agent1Output {
  destinations: DestinationStatus[];
  consolidated: { risk_score: number }; // 0.0 - 1.0, NOT 0-100 — multiply by 100 to display as %
}

// ---------- Agent 2 ----------
export interface CostImpact {
  value: number; // 0.0 - 1.0
  type: "reduction" | "increase" | string;
}

export interface Scenario {
  scenario_name: string;
  scenario_description: string;
  affected_stop: string;
  scenario_probability: number; // 0.0 - 1.0
  estimated_delays: string;
  cost_impact: CostImpact;
}

export interface Agent2Output {
  scenarios: Scenario[];
  consolidated: { supply_chain_analysis: string };
}

// ---------- Agent 3 ----------
export interface AltRoute {
  origin: string;
  destinations: string[];
  mandatory_checkpoints: number[];
  risk_score: number; // 0.0 - 1.0, same scaling caveat as Agent1
  estimated_cost: string;
  estimated_duration: string;
}

export interface Agent3Output {
  alternative_routes: AltRoute[];
}

// ---------- Agent 4 ----------
export interface Agent4Output {
  suggestion: Suggestion;
  wait_duration: string | null;
  confidence: number; // 0.0 - 1.0
  reason: string[];
  factors: string[];
}

// ---------- Agent 5 ----------
// NOTE: markets/suppliers are now structured objects, not plain strings —
// this replaced the old parallel `supplier_reliability_notes` list, which
// had no guaranteed alignment to markets/suppliers by index.
export interface ProcurementEntity {
  name: string;
  reliability_note: string;
  source_url: string; // "" if the model couldn't back this with a real source — treat as unverified
}

export interface Agent5Output {
  markets: ProcurementEntity[];
  suppliers: ProcurementEntity[];
  cost_diff: string; // e.g. "9.7% reduction"
  estimated_savings: string; // e.g. "$6,250.00" — computed server-side when possible
  savings_basis: string; // explains what estimated_savings is grounded against; starts with "unverified" if it's just an AI guess
  import_export_restrictions: string[];
}
