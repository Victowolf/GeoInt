import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  title: string;
  data: unknown;
}

/**
 * Drop this in a CollapsibleCard's `headerAction` slot to give every agent
 * card a one-click way to inspect its complete raw output — useful for
 * trusting/debugging what the model actually returned versus what the
 * summarized card shows.
 */
export function AgentDetailDialog({ title, data }: Props) {
  const [open, setOpen] = useState(false);
  const hasData = data !== null && data !== undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!hasData}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        View Full Output
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">{title}</DialogTitle>
          </DialogHeader>
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
            {hasData ? JSON.stringify(data, null, 2) : "No data available."}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
