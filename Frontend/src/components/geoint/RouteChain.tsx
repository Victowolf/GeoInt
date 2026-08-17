import { Check, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  stops: string[];
  onChange: (stops: string[]) => void;
}

export function RouteChain({ stops, onChange }: Props) {
  const update = (i: number, v: string) => {
    const next = [...stops];
    next[i] = v;
    onChange(next);
  };
  const add = () => onChange([...stops, ""]);
  const remove = (i: number) => {
    if (stops.length <= 1) return;
    onChange(stops.filter((_, idx) => idx !== i));
  };

  const placeholder = (i: number) => {
    if (i === 0) return "Origin";
    if (i === stops.length - 1 && stops.length > 1) return "Destination";
    return "Transit";
  };

  return (
    <div className="flex flex-wrap items-center gap-y-3">
      <AnimatePresence initial={false}>
        {stops.map((stop, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center"
          >
            {/* Route box with inline check */}
            <div className="group relative flex items-center">
              {stops.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="absolute -right-2 -top-2 z-10 hidden h-6 w-6 items-center justify-center rounded-full bg-white text-muted-foreground shadow-md ring-2 ring-border transition-all hover:text-destructive hover:bg-red-50 group-hover:flex"
                  aria-label="Remove stop"
                >
                  <X className="h-4 w-4" strokeWidth={3} />
                </button>
              )}
              <div className="flex items-stretch overflow-hidden rounded-lg border border-input bg-white shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 hover:border-primary/50">
                <input
                  value={stop}
                  onChange={(e) => update(i, e.target.value)}
                  placeholder={placeholder(i)}
                  className="w-40 bg-transparent px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <div className="flex w-10 items-center justify-center border-l border-border text-primary">
                  <Check className="h-5 w-5" strokeWidth={2.5} />
                </div>
              </div>
            </div>
            {/* Connector line to next element */}
            <div className="h-px w-4 bg-border" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Plus button */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={add}
        className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-white shadow-md transition-all hover:shadow-lg hover:bg-primary/90"
        aria-label="Add stop"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}
