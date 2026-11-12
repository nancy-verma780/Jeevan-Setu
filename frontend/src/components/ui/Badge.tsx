import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type Tone = "neutral" | "primary" | "danger" | "warning" | "info" | "success";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-50 text-slate-700 border-slate-300",
  primary: "bg-primary-50 text-primary-900 border-primary-200",
  danger: "bg-danger-50 text-danger-800 border-danger-200",
  warning: "bg-warning-50 text-warning-800 border-warning-200",
  info: "bg-info-50 text-info-800 border-info-200",
  success: "bg-success-50 text-success-800 border-success-200",
};

export function Badge({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold",
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

export function badgeTone(classes: string): string {
  return cx("inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold", classes);
}
