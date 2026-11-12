import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { cx } from "@/components/ui/cx";
import { staff } from "@/lib/api/endpoints";
import type { Hospital, ReadinessItem } from "@/lib/api/types";
import { formatTime } from "@/lib/format";
import { HOSPITAL_KEY } from "./ResourcePanel";

const ITEMS: ReadinessItem[] = ["trauma_surgeon", "ot_free", "blood_available", "ventilator_free"];

/** Capability Truth Panel: live readiness confirmed by staff, expiring after two hours. */
export function ReadinessPanel({ hospital }: { hospital: Hospital }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const set = useMutation({
    mutationFn: ({ item, available }: { item: ReadinessItem; available: boolean }) => staff.readiness(item, available),
    onSuccess: (h) => client.setQueryData(HOSPITAL_KEY, h),
  });
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-700">{t("readiness.title")}</span>
      <ul className="flex flex-wrap gap-2">
        {ITEMS.map((item) => {
          const r = hospital.readiness?.[item];
          const state = r?.state ?? "unknown";
          return (
            <li key={item} className="flex flex-col gap-1 rounded-md border border-slate-200 bg-white p-2">
              <span className="text-xs font-semibold text-slate-800">{t(`readiness.${item}`)}</span>
              <span className="flex gap-1">
                {[true, false].map((value) => {
                  const active = (value && state === "available") || (!value && state === "not_available");
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set.mutate({ item, available: value })}
                      className={cx(
                        "h-8 rounded border px-2 text-xs font-semibold",
                        active ? (value ? "border-success-700 bg-success-50 text-success-800" : "border-danger-700 bg-danger-50 text-danger-800") : "border-slate-300 text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      {value ? t("common.yes") : t("common.no")}
                    </button>
                  );
                })}
              </span>
              <span className={cx("text-[11px]", state === "expired" ? "font-semibold text-warning-800" : "text-slate-600")}>
                {state === "unknown" ? t("readiness.unknown") : state === "expired" ? t("readiness.expired") : t("readiness.until", { time: formatTime(r!.expires_at!) })}
              </span>
            </li>
          );
        })}
      </ul>
      <span className="text-xs text-slate-600">{t("readiness.note")}</span>
    </div>
  );
}
