import { ExternalLink } from "lucide-react";
import { CollapsibleCard, riskColor } from "./CollapsibleCard";
import type { AgentResponse } from "@/lib/request";

interface Props {
  response: AgentResponse | null;
}

function DetailGrid({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map(({ label, value }) => (
        <div key={label} className="rounded-lg border border-border bg-white p-3">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </dt>
          <dd className="mt-1 break-words text-sm font-medium leading-5 text-foreground">
            {value || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-foreground">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2 leading-5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function AgentOutputPanel({ response }: Props) {
  if (!response) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/40 p-7 text-center">
        <div className="text-sm font-semibold text-foreground">
          Analysis output will appear here
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Submit an intelligence request to receive the coordinated agent assessment.
        </p>
      </div>
    );
  }

  const agent1 = response.agent1;
  const agent2 = response.agent2;
  const agent3 = response.agent3;
  const agent4 = response.agent4;
  const agent5 = response.agent5;

  return (
    <div className="space-y-4">
      {agent1 && (
        <CollapsibleCard
          title="Geopolitical Intelligence Agent"
          subtitle="Regional conditions and destination risk"
          defaultOpen
        >
          <div className="space-y-4">
            {agent1.destinations.map((item, index) => (
              <div
                key={`${item.destination}-${index}`}
                className="rounded-lg border border-border bg-white p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-foreground">{item.destination}</h4>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${item.present_status === "safe" ? "bg-green-100 text-green-800" : item.present_status === "caution" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}
                  >
                    {item.present_status}
                  </span>
                </div>
                <p className="text-sm leading-5 text-muted-foreground">
                  {item.source.content || "No source commentary provided."}
                </p>
                {item.source.url && (
                  <a
                    href={item.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    View source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
            <DetailGrid
              items={[
                {
                  label: "Risk score",
                  value: `${agent1.consolidated.risk_score}/100 · ${riskColor(agent1.consolidated.risk_score).label}`,
                },
                { label: "Summary", value: agent1.consolidated.simple_summary },
              ]}
            />
          </div>
        </CollapsibleCard>
      )}

      {agent2 && (
        <CollapsibleCard
          title="Supply Chain Scenario Agent"
          subtitle="Potential disruptions, delays, and commercial impact"
        >
          <div className="space-y-4">
            {agent2.scenarios.map((scenario, index) => (
              <div
                key={`${scenario.scenario_name}-${index}`}
                className="rounded-lg border border-border bg-white p-4"
              >
                <h4 className="text-sm font-semibold text-foreground">{scenario.scenario_name}</h4>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {scenario.scenario_description}
                </p>
                <div className="mt-3">
                  <DetailGrid
                    items={[
                      { label: "Affected stop", value: scenario.affected_stop },
                      {
                        label: "Probability",
                        value: `${Math.round(scenario.scenario_probability * 100)}%`,
                      },
                      { label: "Estimated delay", value: scenario.estimated_delays },
                      {
                        label: "Cost impact",
                        value: `${scenario.cost_impact.value} ${scenario.cost_impact.type}`,
                      },
                      { label: "Estimated amount", value: scenario.estimated_cost_impact_amount },
                      { label: "Plain-language note", value: scenario.plain_language_note },
                    ]}
                  />
                </div>
              </div>
            ))}
            <DetailGrid
              items={[
                {
                  label: "Supply chain analysis",
                  value: agent2.consolidated.supply_chain_analysis,
                },
                {
                  label: "Production yield",
                  value: agent2.consolidated.estimated_production_yield,
                },
                { label: "Demand / supply gap", value: agent2.consolidated.demand_supply_gap },
                { label: "Summary", value: agent2.consolidated.simple_summary },
              ]}
            />
          </div>
        </CollapsibleCard>
      )}

      {agent3 && (
        <CollapsibleCard
          title="Route Optimization Agent"
          subtitle="Alternative routes ranked by risk, cost, and duration"
        >
          <div className="space-y-4">
            {agent3.alternative_routes.map((route, index) => (
              <div
                key={`${route.origin}-${index}`}
                className="rounded-lg border border-border bg-white p-4"
              >
                <div className="text-sm font-semibold leading-5 text-foreground">
                  {[route.origin, ...route.destinations].join(" → ")}
                </div>
                <div className="mt-3">
                  <DetailGrid
                    items={[
                      { label: "Risk score", value: `${route.risk_score}/100` },
                      { label: "Estimated cost", value: route.estimated_cost },
                      { label: "Estimated duration", value: route.estimated_duration },
                      {
                        label: "Mandatory checkpoints",
                        value: route.mandatory_checkpoints.join(", ") || "None",
                      },
                      { label: "Explanation", value: route.explanation },
                    ]}
                  />
                </div>
              </div>
            ))}
            <DetailGrid
              items={[
                {
                  label: "Recommended route",
                  value: `Route ${agent3.consolidated.recommended_route_index + 1}`,
                },
                { label: "Summary", value: agent3.consolidated.simple_summary },
                {
                  label: "Glossary",
                  value:
                    Object.entries(agent3.consolidated.glossary)
                      .map(([term, description]) => `${term}: ${description}`)
                      .join(" · ") || "—",
                },
              ]}
            />
          </div>
        </CollapsibleCard>
      )}

      {agent4 && (
        <CollapsibleCard
          title="Decision Advisor Agent"
          subtitle="Consolidated operational recommendation"
        >
          <div className="space-y-4">
            <DetailGrid
              items={[
                { label: "Recommendation", value: agent4.suggestion },
                { label: "Confidence", value: `${Math.round(agent4.confidence * 100)}%` },
                { label: "Suggested wait duration", value: agent4.wait_duration },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-white p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Reasons
                </h4>
                <List items={agent4.reason} />
              </div>
              <div className="rounded-lg border border-border bg-white p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Factors
                </h4>
                <List items={agent4.factors} />
              </div>
            </div>
          </div>
        </CollapsibleCard>
      )}

      {agent5 && (
        <CollapsibleCard
          title="Market & Supplier Advisory Agent"
          subtitle="Market alternatives, supplier signals, and savings assessment"
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-white p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Markets
                </h4>
                <List
                  items={agent5.markets.map(
                    (market) => `${market.name} — ${market.reliability_note}`,
                  )}
                />
              </div>
              <div className="rounded-lg border border-border bg-white p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Suppliers
                </h4>
                <List
                  items={agent5.suppliers.map(
                    (supplier) => `${supplier.name} — ${supplier.reliability_note}`,
                  )}
                />
              </div>
            </div>
            <DetailGrid
              items={[
                { label: "Cost difference", value: agent5.cost_diff },
                { label: "Estimated savings", value: agent5.estimated_savings },
                { label: "Savings basis", value: agent5.savings_basis },
                { label: "Recommended action", value: agent5.recommended_action },
                { label: "Demand assessment", value: agent5.demand_assessment },
                { label: "Risk-adjusted note", value: agent5.risk_adjusted_note },
              ]}
            />
            <div className="rounded-lg border border-border bg-white p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Import / export restrictions
              </h4>
              <List items={agent5.import_export_restrictions} />
            </div>
          </div>
        </CollapsibleCard>
      )}
    </div>
  );
}
