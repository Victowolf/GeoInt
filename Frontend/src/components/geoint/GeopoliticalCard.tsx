import { ExternalLink } from "lucide-react";
import { CollapsibleCard, riskColor } from "./CollapsibleCard";
import { AgentDetailDialog } from "./AgentDetailDialog";
import type { RequestData, AgentResponse } from "@/lib/request";

interface Props {
  request?: RequestData | null;
  agentResponse?: AgentResponse | null;
}

export function GeopoliticalCard({ request, agentResponse }: Props) {
  const agent1 = agentResponse?.agent1;
  const errorMsg = agentResponse?.errors?.agent1;

  if (!agent1 && !request) {
    return (
      <CollapsibleCard
        title="Geopolitical Intelligence Agent"
        subtitle="Route-specific regional intelligence"
      >
        <div className="py-4 text-center text-sm text-muted-foreground">
          No active request. Create a request to see analysis.
        </div>
      </CollapsibleCard>
    );
  }

  if (!agent1 && errorMsg) {
    return (
      <CollapsibleCard
        title="Geopolitical Intelligence Agent"
        subtitle="Route-specific regional intelligence"
      >
        <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          This agent failed for this request: {errorMsg}
        </div>
      </CollapsibleCard>
    );
  }

  const rows = agent1
    ? agent1.destinations.map((destination) => ({
        destination: destination.destination,
        status: destination.present_status,
        content: destination.source.content,
        url: destination.source.url,
      }))
    : [];

  // consolidated.risk_score comes back as 0.0-1.0 from the backend, NOT
  // 0-100 — this used to render as "0.42%" and an invisible progress bar.
  const avgRiskPct = agent1 ? Math.round(agent1.consolidated.risk_score * 100) : 0;
  const color = riskColor(avgRiskPct);

  return (
    <CollapsibleCard
      title="Geopolitical Intelligence Agent"
      subtitle="Route-specific regional intelligence"
      headerAction={<AgentDetailDialog title="Agent 1 — Full Output" data={agent1} />}
    >
      <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Destination</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.destination}-${index}`}
                className="border-t border-border transition-colors odd:bg-white even:bg-muted/30 hover:bg-accent/40 align-top"
              >
                <td className="px-3 py-2 font-medium text-foreground">{row.destination}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                      row.status === "safe"
                        ? "bg-green-100 text-green-800"
                        : row.status === "caution"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {row.status}
                  </span>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">{row.content}</p>
                </td>
                <td className="px-3 py-2">
                  {row.url ? (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Link
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">No source</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">Aggregate Risk Score</span>
          <span className="font-semibold" style={{ color: color.fill }}>
            {avgRiskPct}% · {color.label}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted ring-1 ring-border">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${avgRiskPct}%`, backgroundColor: color.fill }}
          />
        </div>
      </div>
    </CollapsibleCard>
  );
}
