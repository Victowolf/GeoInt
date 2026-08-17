import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { CollapsibleCard } from "./CollapsibleCard";
import { AgentDetailDialog } from "./AgentDetailDialog";
import type { AgentResponse } from "@/lib/request";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  agentResponse?: AgentResponse | null;
}

export function ScenarioCard({ agentResponse }: Props) {
  const agent2 = agentResponse?.agent2;
  const errorMsg = agentResponse?.errors?.agent2;
  const scenarios = agent2?.scenarios || [];
  const [selected, setSelected] = useState<(typeof scenarios)[number] | null>(null);

  return (
    <>
      <CollapsibleCard
        title="Future Scenario Probability"
        subtitle="Forward-looking risk model, 90-day horizon"
        headerAction={<AgentDetailDialog title="Agent 2 — Full Output" data={agent2} />}
      >
        {errorMsg && !agent2 && (
          <div className="mb-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            This agent failed for this request: {errorMsg}
          </div>
        )}
        {scenarios.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            No scenarios available. Create a request to see analysis.
          </div>
        ) : (
          <>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Probability</th>
                    <th className="px-3 py-2 text-left font-semibold">Scenario</th>
                    <th className="px-3 py-2 text-left font-semibold">Affected Stop</th>
                    <th className="px-3 py-2 text-left font-semibold">Delays</th>
                    <th className="px-3 py-2 text-center font-semibold">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((r, idx) => (
                    <tr
                      key={idx}
                      className="border-t border-border transition-colors odd:bg-white even:bg-muted/30 hover:bg-accent/40"
                    >
                      <td className="px-3 py-2 font-semibold text-foreground">
                        {Math.round(r.scenario_probability * 100)}%
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setSelected(r)}
                          className="text-left text-primary hover:underline"
                        >
                          {r.scenario_name}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-block rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground">
                          {r.affected_stop}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.estimated_delays}</td>
                      <td className="px-3 py-2 text-center">
                        {r.cost_impact.type === "increase" ? (
                          <ArrowUp className="mx-auto h-4 w-4 text-destructive" strokeWidth={2.5} />
                        ) : (
                          <ArrowDown className="mx-auto h-4 w-4 text-success" strokeWidth={2.5} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5">
              <h4 className="mb-2 text-sm font-semibold text-foreground">Supply Chain Analysis</h4>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-foreground">
                  {agent2?.consolidated.supply_chain_analysis}
                </p>
              </div>
            </div>
          </>
        )}
      </CollapsibleCard>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">{selected.scenario_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">{selected.scenario_description}</p>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow
                    label="Probability"
                    value={`${Math.round(selected.scenario_probability * 100)}%`}
                  />
                  <InfoRow label="Estimated Delays" value={selected.estimated_delays} />
                  <InfoRow label="Affected Stop" value={selected.affected_stop} />
                  <InfoRow
                    label="Cost Impact"
                    value={`${selected.cost_impact.value} ${selected.cost_impact.type}`}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-semibold text-foreground">{value}</div>
    </div>
  );
}
