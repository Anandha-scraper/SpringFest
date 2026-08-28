import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { Button } from "@/components/ui/button.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.jsx";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // :00, :05, … :55

function to24h(hour12, minute, period) {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function from24h(value) {
  if (!value) return { hour12: 9, minute: 0, period: "AM" };
  const [h, m] = value.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return { hour12, minute: m, period };
}

/**
 * No official shadcn registry time picker exists — this follows the same
 * pattern shadcn uses elsewhere (Popover trigger + plain form controls
 * inside) rather than inventing something unrelated. Writes/reads the same
 * "HH:MM" 24-hour string the rest of the app already uses.
 */
export function TimePicker({ value, onChange, placeholder = "Pick a time", className }) {
  const [open, setOpen] = React.useState(false);
  const { hour12, minute, period } = from24h(value);

  const set = (patch) => {
    const next = { hour12, minute, period, ...patch };
    onChange(to24h(next.hour12, next.minute, next.period));
  };

  const selectClass =
    "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground", className)}
        >
          <Clock className="mr-2 h-4 w-4 shrink-0" />
          {value ? `${hour12}:${String(minute).padStart(2, "0")} ${period}` : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center gap-2">
          <select
            className={selectClass}
            value={hour12}
            onChange={(e) => set({ hour12: Number(e.target.value) })}
            aria-label="Hour"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <span className="text-muted-foreground">:</span>
          <select
            className={selectClass}
            value={minute}
            onChange={(e) => set({ minute: Number(e.target.value) })}
            aria-label="Minute"
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={period}
            onChange={(e) => set({ period: e.target.value })}
            aria-label="AM or PM"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
