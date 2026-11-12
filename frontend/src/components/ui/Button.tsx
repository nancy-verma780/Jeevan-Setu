import { Loader2, type LucideIcon } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "danger" | "dangerOutline" | "ghost" | "dark";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary-700 text-white hover:bg-primary-800 border border-primary-700",
  secondary: "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50",
  danger: "bg-danger-700 text-white border border-danger-700 hover:bg-danger-800",
  dangerOutline: "bg-white text-danger-700 border border-danger-700 hover:bg-danger-50",
  ghost: "bg-transparent text-primary-700 border border-transparent hover:bg-primary-50",
  dark: "bg-slate-900 text-white border border-slate-900 hover:bg-slate-800",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-2",
  md: "min-h-tap px-4 text-base gap-2",
  lg: "min-h-[56px] px-6 text-base gap-2",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string): string {
  return cx(
    "inline-flex items-center justify-center rounded-lg font-semibold transition-colors",
    "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-600",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon: Icon, loading = false, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden />
      ) : (
        Icon && <Icon className="h-5 w-5 shrink-0" aria-hidden />
      )}
      {children}
    </button>
  );
});
