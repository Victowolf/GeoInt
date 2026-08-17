import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Lightbulb, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const recommendations = [
  {
    rank: 1,
    supplierRegion: "Chennai, India",
    route: "Mumbai → Rotterdam",
    routeStatus: "Normal (Risk score: 0.18)",
    transitDays: 20,
    cost: "$78,500",
    certification: "ISO 9001:2015 verified",
    rationale:
      "This route currently shows stable, low-risk conditions with on-schedule departures, leaving a comfortable buffer within your 25-day maximum. Estimated total cost sits under your budget ceiling, leaving margin for customs and last-mile handling at Rotterdam.",
  },
  {
    rank: 2,
    supplierRegion: "Singapore",
    route: "Singapore → Hamburg",
    routeStatus: "Normal (Risk score: 0.24)",
    transitDays: 22,
    cost: "$82,300",
    certification: "ISO 9001:2015 verified",
    rationale:
      "Slightly tighter on time buffer but still within your window. Hamburg terminal throughput is currently steady, and this option diversifies supplier risk away from the Indian subcontinent if that is a consideration.",
  },
] as const;

const nextSteps = [
  "Confirm ISO 9001 certificate validity dates directly with shortlisted suppliers before issuing a purchase order.",
  "Lock in freight booking at least 5 days before your latest acceptable ship date to absorb potential rate volatility.",
  "Request a secondary quote from the Singapore route as a contingency in case Mumbai capacity tightens.",
] as const;

export function ProcurementAdvisor() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastAnalyzed, setLastAnalyzed] = useState("Today, 09:42 UTC");

  const runAnalysis = () => {
    if (isRunning) return;

    setIsRunning(true);
    window.setTimeout(() => {
      setLastAnalyzed("Just now");
      setIsRunning(false);
    }, 1100);
  };

  return (
    <section className="rounded-xl border border-border bg-white p-6 shadow-[0_1px_3px_rgba(30,58,95,0.06)] md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-primary">Procurement Advisor</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Scenario ready
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare verified supplier and shipping options against the active procurement brief.
          </p>
        </div>
        <div className="text-xs text-muted-foreground sm:pt-1">
          {isRunning ? "Matching routes and suppliers…" : `Last analyzed: ${lastAnalyzed}`}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ReadOnlyField label="Intent" value="Buy" />
        <ReadOnlyField label="Sector" value="Industrial Machinery Parts" />
        <ReadOnlyField label="Budget" value="$85,000 USD" />
        <ReadOnlyField label="Maximum duration" value="25 days" />
        <ReadOnlyField label="Preferred transport" value="Sea Freight" className="md:col-span-2" />
      </div>

      <div className="mt-6">
        <ReadOnlyField
          label="Additional notes"
          value="ISO 9001-certified suppliers only. Prefer origin in South or Southeast Asia. Delivery must reach a European port; onward inland transport not required. Flexible on exact delivery date within the 25-day window."
          multiline
        />
      </div>

      <div className="mt-6">
        <Button
          size="lg"
          className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={isRunning}
          onClick={runAnalysis}
        >
          {isRunning ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isRunning ? "Refreshing recommendations" : "Refresh procurement analysis"}
        </Button>
      </div>

      <FindingsCard />
    </section>
  );
}

function FindingsCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-8 border-t border-border pt-8"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-primary">Procurement Recommendation</h2>
        <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
          2 qualified options
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Based on your budget, timeline, and certification requirements, sea freight from a
        South/Southeast Asian origin to a European port is feasible within your 25-day window, with
        two recommended supplier-route combinations.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {recommendations.map((option) => (
          <article key={option.rank} className="rounded-lg border border-border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Rank {option.rank}
                </div>
                <h3 className="mt-1 text-base font-semibold text-foreground">
                  {option.supplierRegion}
                </h3>
              </div>
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                Recommended
              </span>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <Detail label="Route" value={option.route} />
              <Detail label="Route status" value={option.routeStatus} />
              <Detail label="Estimated transit" value={`${option.transitDays} days`} />
              <Detail label="Estimated cost" value={option.cost} />
              <Detail label="Certification" value={option.certification} success />
            </dl>
            <p className="mt-5 border-t border-border pt-4 text-sm leading-5 text-muted-foreground">
              {option.rationale}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-lg bg-[color:var(--surface)] p-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-primary">Recommended next step</div>
          <p className="mt-1 text-sm leading-5 text-foreground">
            Confirm the Chennai supplier's ISO 9001 certificate, then secure the Mumbai → Rotterdam
            freight booking.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-warning/25 bg-warning/10 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Suez Canal Corridor disruption
        </div>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          Not directly used by either recommended route, but continues to absorb global capacity and
          may push rates upward across all Asia-Europe lanes over the next 2-4 weeks.
        </p>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-primary">Suggested next steps</h3>
        <ul className="mt-3 space-y-3">
          {nextSteps.map((step) => (
            <li
              key={step}
              className="flex items-start gap-2 text-sm leading-5 text-muted-foreground"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

function Detail({
  label,
  value,
  success = false,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-medium ${success ? "text-success" : "text-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  className,
  multiline = false,
}: {
  label: string;
  value: string;
  className?: string;
  multiline?: boolean;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-sm font-semibold">{label}</Label>
      {multiline ? (
        <div className="min-h-28 rounded-lg border border-input bg-muted px-3 py-2 text-sm leading-5 text-foreground">
          {value}
        </div>
      ) : (
        <Input value={value} readOnly className="bg-muted text-foreground" />
      )}
    </div>
  );
}
