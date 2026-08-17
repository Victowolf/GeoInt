import { Satellite } from "lucide-react";
import { motion } from "framer-motion";

export function SpaceCard() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-white p-10 shadow-[0_1px_3px_rgba(30,58,95,0.06)]">
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-[color:var(--surface)] ring-1 ring-border"
        >
          <Satellite className="h-10 w-10 text-primary" strokeWidth={1.6} />
        </motion.div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Space</h2>
        <p className="mt-2 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Coming Soon
        </p>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          Satellite-driven observability, orbit-aware risk modeling, and space-asset procurement —
          arriving in the next platform release.
        </p>
      </div>

      {/* soft decorative orbits */}
      <svg
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 opacity-40"
        viewBox="0 0 200 200"
      >
        <circle cx="100" cy="100" r="60" fill="none" stroke="#d9dee5" />
        <circle cx="100" cy="100" r="90" fill="none" stroke="#d9dee5" strokeDasharray="3 4" />
      </svg>
    </div>
  );
}
