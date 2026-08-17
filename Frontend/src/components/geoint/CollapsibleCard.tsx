import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Optional element rendered on the right of the header, next to the
   * collapse chevron — used for the per-agent "View Full Output" button.
   * Kept as a sibling (not nested inside the toggle button) since it needs
   * its own click handler and HTML doesn't allow nested <button> elements. */
  headerAction?: ReactNode;
}

export function CollapsibleCard({
  title,
  subtitle,
  children,
  defaultOpen = false,
  headerAction,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex w-full items-center justify-between gap-3 px-5 py-4 hover:bg-muted/30 transition-colors rounded-t-xl">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center justify-between gap-3 text-left"
        >
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </motion.div>
        </button>
        {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-5 py-4 bg-muted/20">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function riskColor(score: number) {
  // NOTE: expects score on a 0-100 scale. Backend risk_score fields are
  // 0.0-1.0 — callers must multiply by 100 before passing in here, or
  // every value collapses into the "Low" bucket (this was a live bug: all
  // route risk badges rendered green regardless of actual risk).
  if (score < 30) return { fill: "#16a34a", label: "Low" };
  if (score < 55) return { fill: "#eab308", label: "Moderate" };
  if (score < 80) return { fill: "#ea8a1a", label: "High" };
  return { fill: "#dc2626", label: "Critical" };
}
