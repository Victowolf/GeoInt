import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { TabSwitcher, type TabKey } from "@/components/TabSwitcher";
import { GeointMap } from "@/components/GeointMap";
import { CreateRequestDialog } from "@/components/geoint/CreateRequestDialog";
import { AgentOutputPanel } from "@/components/geoint/AgentOutputPanel";
import { RequestSummary } from "@/components/geoint/RequestSummary";
import { LoaderCircle } from "lucide-react";
import { TradeRouteUpdates } from "@/components/catalogue/TradeRouteUpdates";
import { ProcurementAdvisor } from "@/components/catalogue/ProcurementAdvisor";
import { Button } from "@/components/ui/button";
import { Globe2, Plus } from "lucide-react";
import type { RequestData, AgentResponse } from "@/lib/request";

export const Route = createFileRoute("/")({
  component: Page,
});

type Status = "none" | "preview" | "submitted" | "loading";

const AWS_ENDPOINT = "https://yti4le2qudflx43hh.lambda-url.in-south-1.on.aws/";

function Page() {
  const [tab, setTab] = useState<TabKey>("GEOINT");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [request, setRequest] = useState<RequestData | null>(null);
  const [agentResponse, setAgentResponse] = useState<AgentResponse | null>(null);
  const [status, setStatus] = useState<Status>("none");

  // Simulated fallback response, used only if the orchestrator request fails.
  const buildResponse = (data: RequestData): AgentResponse => ({
    agent1: {
      destinations: data.destinations.map((destination, index) => ({
        destination,
        present_status: (["safe", "caution", "danger"] as const)[index % 3],
        source: {
          url: "",
          content: `Current regional assessment for ${destination}. Conditions should be monitored before departure.`,
          coordinates: {},
        },
      })),
      consolidated: {
        risk_score: 38,
        simple_summary:
          "Regional conditions are manageable, with focused monitoring recommended at each destination.",
      },
    },
    agent2: {
      scenarios: [
        {
          scenario_name: "Transit disruption",
          scenario_description: "Weather and congestion may affect the planned corridor.",
          affected_stop: data.destinations[0] || data.origin,
          scenario_probability: 0.32,
          estimated_delays: "2–3 days",
          cost_impact: { value: 25000, type: "USD" },
          estimated_cost_impact_amount: "$25,000",
          plain_language_note: "Build a short delivery buffer into the operating schedule.",
        },
      ],
      consolidated: {
        supply_chain_analysis:
          "The supply chain remains viable with a moderate contingency allowance.",
        estimated_production_yield: "92–96%",
        demand_supply_gap: "Low",
        simple_summary: "A manageable disruption profile with limited cost exposure.",
      },
    },
    agent3: {
      alternative_routes: [
        {
          origin: data.origin,
          destinations: data.destinations,
          mandatory_checkpoints: data.mandatory_checkpoints,
          risk_score: 34,
          estimated_cost: data.budget,
          estimated_duration: data.maximum_duration,
          explanation: "Balances the requested transport mode, duration, and route-risk profile.",
        },
      ],
      consolidated: {
        simple_summary:
          "The proposed route is the best current balance of time, cost, and exposure.",
        recommended_route_index: 0,
        glossary: {
          risk_score: "Composite exposure measure",
          checkpoint: "Required route validation point",
        },
      },
    },
    agent4: {
      suggestion: "Proceed",
      wait_duration: "No wait required",
      confidence: 0.82,
      reason: [
        "Regional risk remains within tolerance",
        "Expected delivery timeline is achievable",
      ],
      factors: [
        "Requested budget supports the route",
        `Preferred transport: ${data.preferred_transport}`,
      ],
    },
    agent5: {
      markets: [
        {
          name: "Regional market",
          reliability_note: "Stable availability profile",
          source_url: "",
        },
      ],
      suppliers: [
        {
          name: "Qualified supplier network",
          reliability_note: "Reliable delivery record",
          source_url: "",
        },
      ],
      cost_diff: "5–10%",
      estimated_savings: "$50,000",
      savings_basis: "Comparison against baseline procurement cost",
      import_export_restrictions: ["No material restrictions identified for the selected route."],
      recommended_action:
        "Proceed with the recommended route and verify supplier capacity before dispatch.",
      demand_assessment:
        "Demand is expected to remain stable through the requested delivery period.",
      risk_adjusted_note: "Maintain contingency capacity for short transit interruptions.",
    },
    errors: {},
  });

  const runOrchestrator = async (data: RequestData, nextStatus: "preview" | "submitted") => {
    setRequest(data);
    setDialogOpen(false);
    setStatus("loading");

    try {
      const res = await fetch(AWS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(`Orchestrator responded with ${res.status}`);
      }

      const result: AgentResponse = await res.json();
      setAgentResponse(result);
      setStatus(nextStatus);
      toast.success(
        nextStatus === "preview" ? "Preview ready" : "Intelligence analysis is ready.",
        nextStatus === "preview"
          ? { description: "Dashboard populated with a complete analysis." }
          : undefined,
      );
    } catch (error) {
      console.error("Orchestrator request failed, using simulated data:", error);
      setAgentResponse(buildResponse(data));
      setStatus(nextStatus);
      toast.error("Could not reach the orchestrator", {
        description: "Showing a simulated analysis instead.",
      });
    }
  };

  const handlePreview = (data: RequestData) => runOrchestrator(data, "preview");

  const handleSubmit = (data: RequestData) => runOrchestrator(data, "submitted");

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
              <Globe2 className="h-6 w-6" strokeWidth={2} />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground">GeoIntelligence</div>
              <div className="text-xs text-muted-foreground">Procurement & Analysis</div>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <TabSwitcher value={tab} onChange={setTab} />
          </div>

          <div className="flex items-center gap-3">
            {tab === "GEOINT" && (
              <Button
                onClick={() => setDialogOpen(true)}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <Plus className="h-5 w-5" />
                New Request
              </Button>
            )}
            <div className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">Nominal</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <AnimatePresence mode="wait">
          {tab === "GEOINT" ? (
            <motion.section
              key="geoint"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_2fr]"
            >
              <div className="h-[calc(100vh-10rem)] min-h-150 overflow-hidden rounded-lg">
                <GeointMap
                  route={
                    request ? [request.origin, ...request.destinations].filter(Boolean) : undefined
                  }
                />
              </div>
              <div className="relative flex h-[calc(100vh-10rem)] min-h-150 flex-col gap-4 overflow-y-auto pr-2">
                {request && status !== "none" && (
                  <RequestSummary
                    data={request}
                    status={status === "submitted" ? "submitted" : "preview"}
                    onEdit={() => setDialogOpen(true)}
                  />
                )}
                {!request && (
                  <div className="rounded-lg border-2 border-dashed border-border bg-muted p-6 text-center">
                    <div className="text-sm font-semibold text-foreground mb-2">
                      No Active Request
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Create a new request to see analysis
                    </div>
                  </div>
                )}
                <AgentOutputPanel response={agentResponse} />
                {status === "loading" && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/90 p-6 backdrop-blur-sm">
                    <div className="flex max-w-xs flex-col items-center text-center">
                      <LoaderCircle className="h-9 w-9 animate-spin text-primary" />
                      <div className="mt-4 text-sm font-semibold text-foreground">
                        Generating intelligence analysis
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Coordinating the five agent assessments and preparing the output panel.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="cat"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="mx-auto flex max-w-4xl flex-col gap-6"
            >
              <TradeRouteUpdates />
              <ProcurementAdvisor />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <CreateRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={request}
        onPreview={handlePreview}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
