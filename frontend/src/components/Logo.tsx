import { useTranslation } from "react-i18next";
import { cx } from "./ui/cx";

/**
 * The JeevanSetu mark: a bridge ("setu") whose deck is a heartbeat ("jeevan"),
 * on the brand teal.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-hidden className={className}>
      <rect width="48" height="48" rx="12" fill="#0F766E" />
      <path d="M7 31 C 13 17, 35 17, 41 31" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M16 23.6 V31 M24 20.8 V31 M32 23.6 V31" stroke="#99F6E4" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 35 H15 L18.5 29 L22.5 40 L26.5 32 L28.5 35 H43" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ subtitle, size = 32, className }: { subtitle?: string; size?: number; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cx("flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-tight">
        <span className="text-base font-bold tracking-tight text-slate-900">{t("common.appName")}</span>
        {subtitle && <span className="text-xs text-slate-600">{subtitle}</span>}
      </span>
    </span>
  );
}
