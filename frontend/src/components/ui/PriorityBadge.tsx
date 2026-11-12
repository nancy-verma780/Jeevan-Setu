import { useTranslation } from "react-i18next";
import type { Priority } from "@/lib/api/types";
import { PRIORITY_META } from "@/lib/priority";
import { badgeTone } from "./Badge";

export function PriorityBadge({ priority, preliminary = false }: { priority: Priority; preliminary?: boolean }) {
  const { t } = useTranslation();
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  const label = t(`priority.${priority}`);
  return (
    <span className={badgeTone(meta.badge)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {preliminary ? t("status.priorityLabel", { label }) : label}
    </span>
  );
}
