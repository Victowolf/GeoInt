import { motion } from "framer-motion";
import { Pencil, CheckCircle2, Eye } from "lucide-react";
import type { RequestData } from "@/lib/request";

interface Props {
  data: RequestData;
  status: "preview" | "submitted";
  onEdit: () => void;
}

export function RequestSummary({ data, status, onEdit }: Props) {
  const chips: Array<{ label: string; value: string }> = [
    { label: "Transport", value: data.preferred_transport },
    { label: "Budget", value: data.budget },
    { label: "Duration", value: data.maximum_duration },
    { label: "Sector", value: data.sector },
    { label: "Intent", value: data.intent },
    { label: "Commodity", value: data.commodity_name },
  ];

  const route = [data.origin, ...data.destinations].filter(Boolean).join(" → ");

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {status === "submitted" ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <Eye className="h-5 w-5 text-primary" />
            )}
            <h3 className="text-base font-semibold text-foreground">
              {status === "submitted" ? "Submitted Request" : "Preview · Not Submitted"}
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Route: {route}</p>
        </div>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground transition-all hover:bg-muted hover:border-primary"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <span
            key={c.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs"
          >
            <span className="font-semibold text-muted-foreground">{c.label}:</span>
            <span className="text-foreground">{c.value || "—"}</span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}
