import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { emptyRequest, type RequestData } from "@/lib/request";
import { X, Plus, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialData?: RequestData | null;
  onPreview: (data: RequestData) => void;
  onSubmit: (data: RequestData) => void;
}

const SECTORS = [
  "Energy",
  "Commercial Goods",
  "Agriculture",
  "Minerals",
  "Humanitarian Aid",
  "Others",
];
const INTENTS = ["Buy", "Sell", "Transport"];
const TRANSPORT_MODES = ["Waterways", "Airways", "Road", "Rail", "Mixed Transport"];

export function CreateRequestDialog({
  open,
  onOpenChange,
  initialData,
  onPreview,
  onSubmit,
}: Props) {
  const [d, setD] = useState<RequestData>(initialData ?? emptyRequest);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (open) {
      setD(initialData ?? emptyRequest);
      setLocked(false);
    }
  }, [open, initialData]);

  const set = <K extends keyof RequestData>(k: K, v: RequestData[K]) => {
    if (locked) return;
    setD((p) => ({ ...p, [k]: v }));
  };

  const addDestination = () => {
    setD((prev) => ({
      ...prev,
      destinations: [...prev.destinations, ""],
      mandatory_checkpoints: [...prev.mandatory_checkpoints, 0],
    }));
  };

  const toggleCheckpoint = (idx: number, checked: boolean) => {
    const checkpoints = [...d.mandatory_checkpoints];

    checkpoints[idx] = checked ? 1 : 0;

    set("mandatory_checkpoints", checkpoints);
  };

  const updateDestination = (idx: number, v: string) => {
    const next = [...d.destinations];
    next[idx] = v;
    set("destinations", next);
  };

  const removeDestination = (idx: number) => {
    if (d.destinations.length <= 1) return;

    setD((prev) => ({
      ...prev,

      destinations: prev.destinations.filter((_, i) => i !== idx),

      mandatory_checkpoints: prev.mandatory_checkpoints.filter((_, i) => i !== idx),
    }));
  };

  const isValid =
    d.origin.trim().length > 0 &&
    d.destinations.length > 0 &&
    d.destinations.every((dest) => dest.trim().length > 0) &&
    d.preferred_transport.trim().length > 0 &&
    d.budget.trim().length > 0 &&
    d.maximum_duration.trim().length > 0 &&
    d.sector.trim().length > 0 &&
    d.intent.trim().length > 0 &&
    d.commodity_name.trim().length > 0 &&
    d.quantity.trim().length > 0 &&
    d.expected_price.trim().length > 0;

  const handlePreview = () => {
    if (!isValid) return;
    setLocked(false);
    onPreview(d);
  };

  const handleSubmit = () => {
    if (!isValid || locked) return;
    onSubmit(d);
    setLocked(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-2xl font-bold text-foreground">
            Create Intelligence Request
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-full p-2 transition-colors hover:bg-muted"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </DialogHeader>

        {locked && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            This request has been submitted and is now read-only. Click{" "}
            <span className="font-semibold">Preview</span> to make changes.
          </div>
        )}

        <div className={`space-y-6 py-2 ${locked ? "pointer-events-none opacity-60" : ""}`}>
          {/* Origin */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Origin</Label>
            <Input
              placeholder="Enter origin location"
              value={d.origin}
              onChange={(e) => set("origin", e.target.value)}
              disabled={locked}
            />
          </div>

          {/* Destinations */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Destinations</Label>
            <div className="space-y-2">
              {d.destinations.map((dest, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder={`Destination ${idx + 1}`}
                    value={dest}
                    onChange={(e) => updateDestination(idx, e.target.value)}
                    disabled={locked}
                    className="flex-1"
                  />
                  <Label className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Checkbox
                      checked={d.mandatory_checkpoints[idx] === 1}
                      onCheckedChange={(checked) => toggleCheckpoint(idx, checked === true)}
                      disabled={locked}
                    />
                    Mandatory
                  </Label>
                  {d.destinations.length > 1 && (
                    <button
                      onClick={() => removeDestination(idx)}
                      disabled={locked}
                      className="rounded-lg border border-border p-2 hover:bg-red-50 text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addDestination}
              disabled={locked}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Destination
            </button>
          </div>

          {/* Transport & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Preferred Transport</Label>
              <Select
                value={d.preferred_transport}
                onValueChange={(v) => set("preferred_transport", v)}
                disabled={locked}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORT_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Max Duration</Label>
              <Input
                placeholder="e.g., 30 days"
                value={d.maximum_duration}
                onChange={(e) => set("maximum_duration", e.target.value)}
                disabled={locked}
              />
            </div>
          </div>

          {/* Budget & Expected Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Budget</Label>
              <Input
                type="text"
                placeholder="Enter budget"
                value={d.budget}
                onChange={(e) => set("budget", e.target.value)}
                disabled={locked}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Expected Price</Label>
              <Input
                type="text"
                placeholder="Enter expected price"
                value={d.expected_price}
                onChange={(e) => set("expected_price", e.target.value)}
                disabled={locked}
              />
            </div>
          </div>

          {/* Commodity Details */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Commodity Name</Label>
            <Input
              placeholder="e.g., Crude Oil, Wheat"
              value={d.commodity_name}
              onChange={(e) => set("commodity_name", e.target.value)}
              disabled={locked}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Quantity</Label>
            <Input
              placeholder="e.g., 1000 barrels"
              value={d.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              disabled={locked}
            />
          </div>

          {/* Sector & Intent */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Sector</Label>
              <Select value={d.sector} onValueChange={(v) => set("sector", v)} disabled={locked}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sector" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Intent</Label>
              <Select value={d.intent} onValueChange={(v) => set("intent", v)} disabled={locked}>
                <SelectTrigger>
                  <SelectValue placeholder="Select intent" />
                </SelectTrigger>
                <SelectContent>
                  {INTENTS.map((intent) => (
                    <SelectItem key={intent} value={intent}>
                      {intent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handlePreview} disabled={!isValid}>
            Preview
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || locked}
            className="bg-primary hover:bg-primary/90"
          >
            {locked ? "Submitted" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
