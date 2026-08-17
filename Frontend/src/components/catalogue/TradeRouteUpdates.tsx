import { useState } from "react";
import { ChevronDown, Clock3, MapPinned, RefreshCw, Waves } from "lucide-react";

const routes = [
  {
    id: "mumbai-rotterdam",
    route: "Mumbai → Rotterdam",
    status: "Normal",
    riskScore: 0.18,
    updated: "2 hours ago",
    source: "via Reuters",
    summary:
      "Operations are running normally with stable berth availability and on-schedule departures.",
    detailedScenario:
      "Container traffic on the Mumbai–Rotterdam corridor remains stable this week, with average transit times holding at 18-21 days via the Suez-adjacent western route. Berth availability at Jawaharlal Nehru Port (Nhava Sheva) is normal, and no significant queuing has been reported at Rotterdam's Maasvlakte terminals. Freight rates on this lane have held flat over the past 30 days, with capacity utilization at approximately 78%, comfortably below congestion thresholds. Carriers report no weather, labor, or customs disruptions along the route in the current cycle. Shippers moving textiles, pharmaceuticals, and machinery components are advised that current conditions support standard booking windows without expedite premiums. Outlook for the next two weeks remains stable, with no elevated risk indicators flagged by port authorities on either end.",
  },
  {
    id: "shanghai-losangeles",
    route: "Shanghai → Los Angeles",
    status: "Elevated Risk",
    riskScore: 0.57,
    updated: "4 hours ago",
    source: "via Lloyd's List",
    summary: "Congestion is easing, but vessel queues remain above seasonal norms.",
    detailedScenario:
      "The Shanghai–Los Angeles trans-Pacific lane continues to show elevated congestion, though conditions have improved from last month's peak. Vessel queue times at the Port of Los Angeles/Long Beach complex currently average 3-4 days, down from a high of 7 days three weeks ago, but still above the historical seasonal average of 1-2 days. Contributing factors include a temporary surge in pre-holiday retail restocking volumes and reduced chassis availability at inland rail yards. Spot freight rates on this lane have risen roughly 12% over the past two weeks. Terminal operators have added weekend gate hours to clear backlog, and early indicators suggest queue times could normalize within 10-14 days if current inbound volume trends hold. Shippers with time-sensitive cargo are advised to book 5-7 days earlier than usual and consider partial diversion to Oakland or Seattle-Tacoma as a contingency.",
  },
  {
    id: "suez-canal-corridor",
    route: "Suez Canal Corridor",
    status: "Disrupted",
    riskScore: 0.84,
    updated: "3 hours ago",
    source: "via AP News",
    summary: "Rerouting and security precautions continue to extend transit times.",
    detailedScenario:
      "The Suez Canal Corridor remains under significant strain as ongoing regional security concerns in the southern Red Sea approach keep a substantial share of major carriers on precautionary reroutes around the Cape of Good Hope. This adds an estimated 10-14 days and 3,000-4,000 nautical miles to affected voyages between Asia and Europe/the US East Coast. Canal transit volumes are running well below typical levels, and war-risk insurance premiums for vessels still transiting the corridor have risen sharply. Freight rates on Asia-Europe and Asia-US East Coast lanes have climbed 20-35% as a direct consequence of the capacity absorbed by longer routings. Canal authorities have maintained standard toll and convoy operations for vessels that continue transiting, but carrier risk committees are reassessing routing decisions on a rolling basis. Shippers are strongly advised to build in extended buffer time, confirm current carrier routing before booking, and treat published transit estimates as provisional until conditions stabilize.",
  },
  {
    id: "singapore-hamburg",
    route: "Singapore → Hamburg",
    status: "Normal",
    riskScore: 0.24,
    updated: "6 hours ago",
    source: "via Maersk",
    summary: "Container availability and port throughput are tracking close to seasonal norms.",
    detailedScenario:
      "The Singapore–Hamburg corridor is operating within normal parameters, with container availability at origin and destination tracking close to seasonal norms. Throughput at the Port of Hamburg's Waltershof and Burchardkai terminals is steady, with dwell times averaging under 3 days. Singapore's PSA terminals report no significant vessel bunching, and feeder connections into the wider Baltic and North Sea network remain on schedule. Rate volatility on this lane has been minimal over the last month, with only a marginal uptick tied to general fuel surcharge adjustments rather than route-specific pressure. Some carriers continue routing a portion of Asia-Europe volume via the Cape of Good Hope rather than Suez, which has added a few days to a subset of sailings, but overall service reliability on this specific city pair remains high. No immediate risk escalation is anticipated for the coming two-week window.",
  },
  {
    id: "panama-canal-corridor",
    route: "Panama Canal Corridor",
    status: "Elevated Risk",
    riskScore: 0.62,
    updated: "1 day ago",
    source: "via Bloomberg",
    summary: "Draft restrictions and booking limits continue to require capacity planning.",
    detailedScenario:
      "The Panama Canal Corridor remains under elevated risk status as the Panama Canal Authority continues to manage draft restrictions and daily transit slot limits tied to water-level management in Gatun Lake. Maximum permitted drafts remain below full capacity for a portion of the fleet, forcing some vessels to sail partially loaded or seek alternative routings via the US intermodal rail network or the Suez/Cape corridors. Daily transit bookings remain capped below pre-restriction levels, and premium 'auction slot' transits are commanding significant surcharges for carriers seeking to bypass the standard queue. Reservoir levels have shown modest seasonal recovery, and canal authorities have signaled gradual easing of restrictions is possible in the coming weeks if rainfall trends continue. Shippers moving East Asia–US East Coast or Caribbean-bound cargo are advised to confirm current draft allowances with carriers before finalizing bookings and to maintain contingency routing options.",
  },
] as const;

const statusStyles = {
  Normal: "bg-success/10 text-success",
  "Elevated Risk": "bg-warning/10 text-warning",
  Disrupted: "bg-danger/10 text-danger",
} as const;

export function TradeRouteUpdates() {
  const [lastSynced, setLastSynced] = useState("Today, 09:42 UTC");
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshUpdates = () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    window.setTimeout(() => {
      setLastSynced("Just now");
      setIsRefreshing(false);
    }, 900);
  };

  return (
    <section className="rounded-xl border border-border bg-white p-6 shadow-[0_1px_3px_rgba(30,58,95,0.06)] md:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MapPinned className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-primary">Global Trade Route Updates</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                Live
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Monitored shipping intelligence across major freight corridors, with sourced risk and
              disruption signals refreshed as they arrive.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground lg:pt-1">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{isRefreshing ? "Syncing five route feeds…" : `Last synced: ${lastSynced}`}</span>
          <button
            type="button"
            aria-label="Refresh route updates"
            aria-live="polite"
            disabled={isRefreshing}
            onClick={refreshUpdates}
            className="rounded-lg p-2 transition-colors hover:bg-muted hover:text-primary disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-7">
        <RouteMetric label="Monitored routes" value="05" />
        <RouteMetric label="Elevated signals" value="03" />
        <RouteMetric label="Latest update" value="2h" />
      </div>

      <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {routes.map((route) => {
          const expanded = expandedRoute === route.id;

          return (
            <article
              key={route.id}
              className="rounded-lg border border-border bg-white p-5 transition-all hover:border-primary/50 hover:shadow-[0_6px_18px_rgba(30,58,95,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Waves className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <h3 className="text-sm font-semibold leading-5 text-foreground">{route.route}</h3>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${statusStyles[route.status]}`}
                >
                  {route.status}
                </span>
              </div>
              <p className="mt-4 text-sm leading-5 text-muted-foreground">{route.summary}</p>
              {expanded && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Detailed scenario
                  </div>
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">
                    {route.detailedScenario}
                  </p>
                </div>
              )}
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpandedRoute(expanded ? null : route.id)}
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                {expanded ? "Hide detailed scenario" : "Read detailed scenario"}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>
              <div className="my-4 border-t border-border" />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Risk score: {route.riskScore.toFixed(2)}</span>
                <span>{route.updated}</span>
              </div>
              <span className="mt-4 inline-flex rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
                {route.source}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RouteMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
