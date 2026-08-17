import { useState } from "react";
import { CollapsibleCard, riskColor } from "./CollapsibleCard";
import { AgentDetailDialog } from "./AgentDetailDialog";
import type { AgentResponse } from "@/lib/request";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  agentResponse?: AgentResponse | null;
}

export function RouteOptimizationCard({ agentResponse }: Props) {
  const agent3 = agentResponse?.agent3;
  const errorMsg = agentResponse?.errors?.agent3;
  const routes = agent3?.alternative_routes || [];
  const [selected, setSelected] = useState<(typeof routes)[number] | null>(null);

  return (
    <>
      <CollapsibleCard
        title="Route Optimization Agent"
        subtitle="Ranked alternatives by combined risk-cost score"
        headerAction={<AgentDetailDialog title="Agent 3 — Full Output" data={agent3} />}
      >
        {errorMsg && !agent3 && (
          <div className="mb-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            This agent failed for this request: {errorMsg}
          </div>
        )}
        {routes.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            No routes available. Create a request to see analysis.
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Route</th>
                  <th className="px-3 py-2 text-left font-semibold">Cost</th>
                  <th className="px-3 py-2 text-left font-semibold">Duration</th>
                  <th className="px-3 py-2 text-right font-semibold">Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r, idx) => {
                  // risk_score is 0.0-1.0 from the backend — scale to 0-100
                  // before feeding riskColor's thresholds, or every route
                  // silently renders "Low"/green regardless of real risk.
                  const riskPct = Math.round(r.risk_score * 100);
                  const c = riskColor(riskPct);
                  const routeName = `${r.origin} → ${r.destinations.join(" → ")}`;
                  return (
                    <tr
                      key={idx}
                      className="border-t border-border transition-colors odd:bg-white even:bg-muted/30 hover:bg-accent/40"
                    >
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setSelected(r)}
                          className="text-left text-primary hover:underline"
                        >
                          {routeName}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.estimated_cost}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.estimated_duration}</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                          style={{ backgroundColor: c.fill }}
                        >
                          {riskPct}% · {c.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleCard>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {selected.origin} → {selected.destinations.join(" → ")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Risk Score" value={`${Math.round(selected.risk_score * 100)}%`} />
                  <Info label="Estimated Cost" value={selected.estimated_cost} />
                  <Info label="Duration" value={selected.estimated_duration} />
                  <Info
                    label="Checkpoints"
                    value={selected.mandatory_checkpoints.length.toString()}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-semibold text-foreground">{value}</div>
    </div>
  );
}
