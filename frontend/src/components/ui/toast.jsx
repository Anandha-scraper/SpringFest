/** App-wide transient notifications.
 *
 * Replaces the inline `<p className="error">` blocks that used to sit under
 * every admin form. Those had two problems: on a long page the message
 * appeared somewhere the organiser wasn't looking, and a success had nowhere
 * to go at all, so saves were silent.
 *
 * Deliberately hand-rolled rather than pulling in a toast library — the app
 * styles everything with its own CSS and the whole behaviour is a list plus a
 * timeout.
 *
 * Read-path failures (a page that loaded nothing) should still render inline,
 * not here: a toast fades, and a blank page with no explanation is worse than
 * a red paragraph.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import "@/styles/components/toast.css";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

const DISMISS_MS = 4000;

const ICONS = {
  ok: CheckCircle2,
  bad: TriangleAlert,
  info: Info,
};

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // Ids only need to be unique within a session, and two toasts raised in the
  // same millisecond would collide on Date.now().
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, tone = "info") => {
      const text = typeof message === "string" ? message : message?.message;
      if (!text) return;
      const id = ++nextId.current;
      setToasts((prev) => [...prev, { id, tone, message: text }]);
      setTimeout(() => dismiss(id), DISMISS_MS);
    },
    [dismiss],
  );

  // `toast.ok(...)` / `toast.bad(err)` read better at the call site than
  // passing a tone string every time, and `bad` accepts an Error directly so
  // a catch block is just `catch (err) { toast.bad(err); }`.
  const toast = useMemo(() => {
    const fn = (message, tone) => push(message, tone);
    fn.ok = (message) => push(message, "ok");
    fn.bad = (message) => push(message || "Something went wrong", "bad");
    fn.info = (message) => push(message, "info");
    return fn;
  }, [push]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.tone] ?? Info;
          return (
            <div key={t.id} className={`toast toast-${t.tone}`}>
              <Icon size={17} className="toast-icon" aria-hidden="true" />
              <span className="toast-message">{t.message}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside <ToastProvider>");
  return toast;
}
