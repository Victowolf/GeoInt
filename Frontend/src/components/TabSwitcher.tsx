import { motion } from "framer-motion";
import { Check } from "lucide-react";

export type TabKey = "GEOINT" | "CATALOGUE";

interface Props {
  value: TabKey;
  onChange: (v: TabKey) => void;
}

const TABS: TabKey[] = ["GEOINT", "CATALOGUE"];

export function TabSwitcher({ value, onChange }: Props) {
  return (
    <div className="flex items-center">
      <div className="relative inline-flex items-center rounded-full border border-border bg-muted p-1">
        {TABS.map((t) => {
          const active = t === value;
          return (
            <button
              key={t}
              onClick={() => onChange(t)}
              className={`relative z-10 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active ? "text-white" : "text-[#5d7285]"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="tab-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {active && <Check className="h-4 w-4" strokeWidth={3} />}
              <span>{t}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
