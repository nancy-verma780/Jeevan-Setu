import { useTranslation } from "react-i18next";
import type { Freshness } from "@/lib/api/types";
import { cx } from "./ui/cx";

/** Data Freshness Confidence: the age of a hospital figure and how much to trust it. */
export function FreshnessText({ freshness, className }: { freshness?: Freshness; className?: string }) {
  const { t } = useTranslation();
  if (!freshness) return null;
  const minutes = freshness.age_minutes ?? 0;
  const age = minutes < 90 ? t("freshness.minutes", { n: minutes }) : t("freshness.hours", { n: Math.round(minutes / 60) });
  const tone = freshness.level === "fresh" ? "text-success-800" : freshness.level === "ageing" ? "text-warning-800" : "text-danger-800";
  return <span className={cx("text-xs", tone, className)}>{t(`freshness.${freshness.level}`, { age })}</span>;
}
