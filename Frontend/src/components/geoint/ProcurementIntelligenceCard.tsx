import { ExternalLink, BadgeCheck, BadgeAlert } from "lucide-react";
import { CollapsibleCard } from "./CollapsibleCard";
import { AgentDetailDialog } from "./AgentDetailDialog";
import type { AgentResponse, ProcurementEntity } from "@/lib/request";

interface Props {
  agentResponse?: AgentResponse | null;
}

export function ProcurementIntelligenceCard({ agentResponse }: Props) {
  const agent5 = agentResponse?.agent5;
  const errorMsg = agentResponse?.errors?.agent5;

  // savings_basis starts with "unverified" when neither quantity x price
  // nor budget could be parsed into real numbers server-side — in that case
  // estimated_savings is just the LLM's own guess, so flag it as such
  // rather than presenting it with the same authority as a computed figure.
  const isComputed = !!agent5 && !agent5.savings_basis?.toLowerCase().startsWith("unverified");

  return (
    <CollapsibleCard
      title="Procurement Intelligence"
      subtitle="Market, supplier, and trade constraint assessment"
      headerAction={<AgentDetailDialog title="Agent 5 — Full Output" data={agent5} />}
    >
      {errorMsg && !agent5 && (
        <div className="mb-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          This agent failed for this request: {errorMsg}
        </div>
      )}
      {!agent5 ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          No procurement intelligence available. Submit a request to see analysis.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Cost Difference" value={agent5.cost_diff} />
            <div className="rounded-lg border border-border bg-muted p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Estimated Savings
                </div>
                <span
                  title={agent5.savings_basis}
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isComputed ? "bg-success/10 text-success" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {isComputed ? (
                    <BadgeCheck className="h-3 w-3" />
                  ) : (
                    <BadgeAlert className="h-3 w-3" />
                  )}
                  {isComputed ? "Computed" : "AI estimate"}
                </span>
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {agent5.estimated_savings || "—"}
              </div>
              {agent5.savings_basis && (
                <p className="mt-1 text-[11px] text-muted-foreground">{agent5.savings_basis}</p>
              )}
            </div>
          </div>

          <EntitySection label="Markets" entities={agent5.markets} />
          <EntitySection label="Suppliers" entities={agent5.suppliers} />

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Import &amp; Export Restrictions
            </div>
            <div className="flex flex-wrap gap-2">
              {agent5.import_export_restrictions.length > 0 ? (
                agent5.import_export_restrictions.map((value, index) => (
                  <span
                    key={`${value}-${index}`}
                    className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground"
                  >
                    {value}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None reported</span>
              )}
            </div>
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value || "—"}</div>
    </div>
  );
}

function EntitySection({ label, entities }: { label: string; entities: ProcurementEntity[] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {entities.length === 0 ? (
        <div className="text-sm text-muted-foreground">None reported</div>
      ) : (
        <div className="space-y-2">
          {entities.map((entity, index) => (
            <div
              key={`${entity.name}-${index}`}
              className="rounded-lg border border-border bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">{entity.name}</div>
                {entity.source_url ? (
                  <a
                    href={entity.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Source <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    Unsourced
                  </span>
                )}
              </div>
              {entity.reliability_note && (
                <p className="mt-1 text-xs text-muted-foreground">{entity.reliability_note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
