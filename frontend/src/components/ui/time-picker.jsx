import * as React from "react";
import "@/styles/components/time-picker.css";
import { Clock } from "lucide-react";
import { cn } from "@/utils/cn.js";
import { Button } from "@/components/ui/button.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.jsx";

const HOUR_LABELS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_LABELS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function to24h(hour12, minute, period) {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function from24h(value) {
  if (!value) return { hour12: 9, minute: 0, period: "AM" };
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return { hour12: 9, minute: 0, period: "AM" };
  return {
    hour12: h % 12 || 12,
    minute: clamp(m, 0, 59),
    period: h >= 12 ? "PM" : "AM",
  };
}

const pad = (n) => String(n).padStart(2, "0");

/**
 * Material-style time picker, reused in the event creation form.
 *  - `value` is a "HH:MM" 24-hour string (what the app/backend use).
 *  - `onChange(hhmm)` fires only when OK is pressed; the on-screen clock is
 *    12-hour + AM/PM and converts on commit.
 *  - Two selection modes: click the hour box to pick the hour, the minute box
 *    to pick the minute. The clock face swaps between an hour ring and a
 *    minute ring; click or drag anywhere on the face for per-minute precision.
 *  - Click the already-active box again (or the keyboard icon) to type the
 *    value directly — e.g. 12:43.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "Pick a time",
  className,
  disabled = false,
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(() => from24h(value));
  const [mode, setMode] = React.useState("hour"); // "hour" | "minute"
  const [textMode, setTextMode] = React.useState(false);
  const [focusField, setFocusField] = React.useState("hour");
  const [hourText, setHourText] = React.useState("");
  const [minuteText, setMinuteText] = React.useState("");

  const faceRef = React.useRef(null);
  const draggingRef = React.useRef(false);
  const hourInputRef = React.useRef(null);
  const minuteInputRef = React.useRef(null);

  // Reset the working copy every time the popover opens.
  React.useEffect(() => {
    if (!open) return;
    const next = from24h(value);
    setDraft(next);
    setMode("hour");
    setTextMode(false);
    setHourText(pad(next.hour12));
    setMinuteText(pad(next.minute));
  }, [open, value]);

  // Focus the right input when text mode turns on.
  React.useEffect(() => {
    if (!textMode) return;
    const el = focusField === "minute" ? minuteInputRef.current : hourInputRef.current;
    el?.focus();
    el?.select();
  }, [textMode, focusField]);

  // Responsive clock size.
  const [clockSize, setClockSize] = React.useState(250);
  React.useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w <= 360) setClockSize(190);
      else if (w <= 560) setClockSize(210);
      else setClockSize(250);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const radius = clockSize / 2 - 20;
  const center = clockSize / 2;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  // ----- clock face pointer handling -----
  const applyPoint = (clientX, clientY) => {
    const face = faceRef.current;
    if (!face) return;
    const rect = face.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;
    if (mode === "hour") {
      const h = Math.round(deg / 30) % 12 || 12;
      set({ hour12: h });
    } else {
      set({ minute: Math.round(deg / 6) % 60 });
    }
  };

  const onPointerDown = (e) => {
    if (textMode) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    applyPoint(e.clientX, e.clientY);
  };
  const onPointerMove = (e) => {
    if (draggingRef.current) applyPoint(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (mode === "hour") setMode("minute"); // auto-advance, like Material
  };

  // ----- display box clicks -----
  const selectField = (field) => {
    if (textMode || mode === field) {
      // Second click on the active box -> type it directly.
      setHourText(pad(draft.hour12));
      setMinuteText(pad(draft.minute));
      setFocusField(field);
      setMode(field);
      setTextMode(true);
    } else {
      setMode(field);
    }
  };

  const toggleTextMode = () => {
    setHourText(pad(draft.hour12));
    setMinuteText(pad(draft.minute));
    setTextMode((t) => !t);
  };

  // ----- text inputs -----
  // Keep the field itself inside range as the user types: strip non-digits,
  // cap at 2 chars, and if the two-digit number overflows, fall back to the
  // last digit typed (so "1" then "5" in the hour field lands on "5", not "15").
  const sanitize = (raw, max) => {
    const v = raw.replace(/\D/g, "").slice(0, 2);
    if (v === "") return "";
    if (parseInt(v, 10) <= max) return v;
    const last = v.slice(-1);
    return parseInt(last, 10) <= max ? last : String(max);
  };

  const onHourInput = (e) => {
    const v = sanitize(e.target.value, 12);
    setHourText(v);
    const n = parseInt(v, 10);
    if (n >= 1 && n <= 12) set({ hour12: n });
  };
  const onMinuteInput = (e) => {
    const v = sanitize(e.target.value, 59);
    setMinuteText(v);
    const n = parseInt(v, 10);
    if (v !== "" && n >= 0 && n <= 59) set({ minute: n });
  };

  const normalizeHour = () => {
    const n = parseInt(hourText, 10);
    const h = Number.isNaN(n) ? draft.hour12 : clamp(n || 12, 1, 12);
    set({ hour12: h });
    setHourText(pad(h));
  };
  const normalizeMinute = () => {
    const n = parseInt(minuteText, 10);
    const m = Number.isNaN(n) ? draft.minute : clamp(n, 0, 59);
    set({ minute: m });
    setMinuteText(pad(m));
  };

  const commit = () => {
    let { hour12, minute } = draft;
    if (textMode) {
      const h = parseInt(hourText, 10);
      const m = parseInt(minuteText, 10);
      hour12 = Number.isNaN(h) ? hour12 : clamp(h || 12, 1, 12);
      minute = Number.isNaN(m) ? minute : clamp(m, 0, 59);
    }
    onChange(to24h(hour12, minute, draft.period));
    setOpen(false);
  };

  const parsed = value ? from24h(value) : null;
  const display = parsed ? `${parsed.hour12}:${pad(parsed.minute)} ${parsed.period}` : "";

  const clockItems =
    mode === "hour"
      ? HOUR_LABELS.map((h) => ({ label: h, value: h, angle: h * 30 }))
      : MINUTE_LABELS.map((m) => ({ label: pad(m), value: m, angle: m * 6 }));

  const handAngle = mode === "hour" ? draft.hour12 * 30 : draft.minute * 6;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "ctp-trigger w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4 shrink-0" />
          {display || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="ctp-card" style={{ "--ctp-clock-size": `${clockSize}px` }}>
          <div className="ctp-header">SELECT TIME</div>

          <div className="ctp-display">
            {textMode ? (
              <input
                ref={hourInputRef}
                className="ctp-value-input"
                inputMode="numeric"
                value={hourText}
                onChange={onHourInput}
                onFocus={(e) => e.target.select()}
                onBlur={normalizeHour}
                onKeyDown={(e) => {
                  if (e.key === "Enter") minuteInputRef.current?.focus();
                  if (e.key === "Escape") setTextMode(false);
                }}
                aria-label="Hour"
              />
            ) : (
              <div
                className={cn("ctp-value", mode === "hour" && "active")}
                onClick={() => selectField("hour")}
                title="Click to set the hour"
              >
                {pad(draft.hour12)}
              </div>
            )}

            <div className="ctp-colon">:</div>

            {textMode ? (
              <input
                ref={minuteInputRef}
                className="ctp-value-input"
                inputMode="numeric"
                value={minuteText}
                onChange={onMinuteInput}
                onFocus={(e) => e.target.select()}
                onBlur={normalizeMinute}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setTextMode(false);
                }}
                aria-label="Minute"
              />
            ) : (
              <div
                className={cn("ctp-value", mode === "minute" && "active")}
                onClick={() => selectField("minute")}
                title="Click to set the minutes"
              >
                {pad(draft.minute)}
              </div>
            )}

            <div className="ctp-period">
              <div
                className={cn("ctp-period-btn", draft.period === "AM" && "active")}
                onClick={() => set({ period: "AM" })}
              >
                AM
              </div>
              <div
                className={cn("ctp-period-btn", draft.period === "PM" && "active")}
                onClick={() => set({ period: "PM" })}
              >
                PM
              </div>
            </div>
          </div>

          <div className="ctp-clock-wrap">
            <div
              ref={faceRef}
              className={cn("ctp-clock-face", textMode && "disabled")}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div className="ctp-center" />

              <div
                className={cn("ctp-hand", mode === "minute" && "minute")}
                style={{
                  transform: `rotate(${handAngle}deg)`,
                  height: radius,
                  top: center - radius,
                  left: center - 1,
                }}
              >
                <div className="ctp-hand-line" />
                <div className="ctp-hand-circle" />
              </div>

              {clockItems.map(({ label, value: v, angle }) => {
                const rad = (angle - 90) * (Math.PI / 180);
                const x = center + radius * Math.cos(rad);
                const y = center + radius * Math.sin(rad);
                const isSelected =
                  mode === "hour" ? draft.hour12 === v : draft.minute === v;
                return (
                  <div
                    key={label}
                    className={cn("ctp-number", isSelected && "selected")}
                    style={{ left: `${x}px`, top: `${y}px`, transform: "translate(-50%, -50%)" }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ctp-footer">
            <div
              className={cn("ctp-icon-btn", textMode && "active")}
              onClick={toggleTextMode}
              role="button"
              title={textMode ? "Use the clock" : "Type the time"}
            >
              <svg focusable="false" aria-hidden="true" viewBox="0 0 24 24">
                <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"></path>
              </svg>
            </div>
            <div className="ctp-actions">
              <button type="button" className="ctp-text-btn" onClick={() => setOpen(false)}>
                CANCEL
              </button>
              <button type="button" className="ctp-text-btn" onClick={commit}>
                OK
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
