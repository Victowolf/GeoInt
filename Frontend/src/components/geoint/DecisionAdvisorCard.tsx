import { CollapsibleCard } from "./CollapsibleCard";
import { AgentDetailDialog } from "./AgentDetailDialog";
import type { RequestData, AgentResponse, Suggestion } from "@/lib/request";

const styles: Record<Suggestion, { bg: string; label: string }> = {
  Proceed: { bg: "#2e9f65", label: "Proceed" },
  Caution: { bg: "#f4a62a", label: "Caution" },
  Wait: { bg: "#f59e0b", label: "Wait" },
  Reconsider: { bg: "#dc2626", label: "Reconsider" },
  "Use Alternate Route": { bg: "#dc2626", label: "Use Alternate Route" },
};

interface Props {
  request?: RequestData | null;
  agentResponse?: AgentResponse | null;
}

export function DecisionAdvisorCard({ request, agentResponse }: Props) {
  const agent4 = agentResponse?.agent4;
  const errorMsg = agentResponse?.errors?.agent4;

  if (!agent4 && !request) {
    return (
      <CollapsibleCard
        title="Decision Advisor"
        subtitle="Aggregated recommendation across all intelligence agents"
      >
        <div className="py-4 text-center text-sm text-muted-foreground">
          No recommendation available. Create a request to see analysis.
        </div>
      </CollapsibleCard>
    );
  }

  if (!agent4 && errorMsg) {
    return (
      <CollapsibleCard
        title="Decision Advisor"
        subtitle="Aggregated recommendation across all intelligence agents"
      >
        <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          No recommendation: {errorMsg}
        </div>
      </CollapsibleCard>
    );
  }

  const suggestion = agent4?.suggestion ?? "Proceed";
  const style = styles[suggestion];
  const confidence = agent4 ? Math.round(agent4.confidence * 100) : 0;

  return (
    <CollapsibleCard
      title="Decision Advisor"
      subtitle="Aggregated recommendation across all intelligence agents"
      headerAction={<AgentDetailDialog title="Agent 4 — Full Output" data={agent4} />}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="inline-flex items-center justify-center rounded-lg px-6 py-2 text-lg font-semibold tracking-wide text-white shadow-md"
          style={{ backgroundColor: style.bg }}
        >
          {style.label}
        </div>

        {agent4 && (
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Confidence Level</div>
            <div className="text-2xl font-bold text-foreground">{confidence}%</div>
          </div>
        )}
      </div>

      {agent4 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reason
            </div>
            <ul className="space-y-2 text-sm">
              {agent4.reason.map((reason, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-foreground">{reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Factors
            </div>
            <ul className="space-y-2 text-sm">
              {agent4.factors.map((factor, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                  <span className="text-foreground">{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {agent4?.suggestion === "Wait" && agent4.wait_duration && (
        <div className="mt-4 rounded-lg border border-warning/20 bg-warning/5 p-3">
          <div className="text-xs font-semibold text-warning">Suggested Wait Duration</div>
          <div className="mt-1 text-sm font-medium text-foreground">{agent4.wait_duration}</div>
        </div>
      )}
    </CollapsibleCard>
  );
}
