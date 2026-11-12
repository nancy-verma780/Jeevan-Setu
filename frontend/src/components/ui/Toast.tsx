import { AlertCircle, CheckCircle2 } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

type ToastTone = "success" | "error";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setItems((current) => [...current.slice(-2), { id, tone, message }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 5000);
  }, []);

  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((item) => {
          const Icon = item.tone === "success" ? CheckCircle2 : AlertCircle;
          return (
            <div
              key={item.id}
              role="status"
              className={cx(
                "pointer-events-auto flex max-w-md items-start gap-2 rounded-lg px-4 py-3 text-sm shadow-overlay motion-safe:animate-fade-in",
                item.tone === "success" ? "bg-slate-900 text-white" : "bg-danger-800 text-white",
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {item.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
