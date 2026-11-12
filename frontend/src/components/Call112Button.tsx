import { Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "./ui/cx";

type Variant = "compact" | "outline" | "solid" | "hero";

const STYLES: Record<Variant, string> = {
  compact: "h-9 px-3 text-sm border border-danger-700 text-danger-700 bg-white hover:bg-danger-50",
  outline: "min-h-tap px-4 text-base border border-danger-700 text-danger-700 bg-white hover:bg-danger-50",
  solid: "min-h-tap px-4 text-base border border-danger-700 bg-danger-700 text-white hover:bg-danger-800",
  hero: "min-h-[96px] px-6 text-2xl bg-white text-danger-800",
};

/** Opens the dialler. Present on every citizen screen. */
export function Call112Button({ variant = "outline", label, className }: { variant?: Variant; label?: string; className?: string }) {
  const { t } = useTranslation();
  const text = label ?? t("common.call112");
  return (
    <a
      href="tel:112"
      aria-label={variant === "compact" ? text : undefined}
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg font-bold no-underline", STYLES[variant], className)}
    >
      <Phone className={variant === "hero" ? "h-8 w-8" : "h-4 w-4"} aria-hidden />
      {variant === "compact" ? "112" : text}
    </a>
  );
}
