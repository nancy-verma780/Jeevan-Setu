import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Minus, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FreshnessText } from "@/components/FreshnessText";
import { cx } from "@/components/ui/cx";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { staff } from "@/lib/api/endpoints";
import type { Hospital, Service } from "@/lib/api/types";
import { formatTime } from "@/lib/format";

const ALL_SERVICES: Service[] = ["general_emergency", "trauma_care", "orthopaedics", "burn_care", "cardiac_care"];
export const HOSPITAL_KEY = ["staff-hospital"] as const;

export function ResourcePanel() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const toast = useToast();
  const hospital = useQuery({ queryKey: HOSPITAL_KEY, queryFn: staff.hospital });
  const save = useMutation({
    mutationFn: staff.updateHospital,
    onSuccess: (data) => client.setQueryData(HOSPITAL_KEY, data),
    onError: () => toast(t("errors.generic"), "error"),
  });

  if (hospital.isPending) return <Skeleton className="h-28" />;
  if (hospital.isError) return <ErrorState error={hospital.error} onRetry={() => void hospital.refetch()} />;
  const h: Hospital = hospital.data;
  const beds = h.free_beds ?? 0;

  return (
    <section id="resources" aria-label={t("staff.navResources")} className="flex flex-wrap items-start gap-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <span id="beds-label" className="font-semibold">
          {t("staff.beds")}
        </span>
        <div role="group" aria-labelledby="beds-label" className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("staff.fewerBeds")}
            disabled={beds <= 0 || save.isPending}
            onClick={() => save.mutate({ free_beds: beds - 1 })}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white disabled:opacity-50"
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <span aria-live="polite" className="tabular min-w-[40px] text-center text-xl font-bold">
            {h.free_beds ?? "—"}
          </span>
          <button
            type="button"
            aria-label={t("staff.moreBeds")}
            disabled={save.isPending}
            onClick={() => save.mutate({ free_beds: beds + 1 })}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <span className="text-xs text-slate-600">
          {h.beds_updated_at ? t("staff.bedsUpdated", { time: formatTime(h.beds_updated_at) }) : t("staff.bedsNotReported")}
        </span>
        <FreshnessText freshness={h.freshness} />
      </div>

      <div className="flex min-w-[280px] flex-1 flex-col gap-2">
        <span className="font-semibold">{t("staff.servicesNow")}</span>
        <div className="flex flex-wrap gap-2">
          {ALL_SERVICES.map((service) => {
            const on = h.services.includes(service);
            return (
              <button
                key={service}
                type="button"
                aria-pressed={on}
                disabled={save.isPending}
                onClick={() => save.mutate({ services: on ? h.services.filter((s) => s !== service) : [...h.services, service] })}
                className={cx(
                  "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium",
                  on ? "border-primary-700 bg-primary-50 text-primary-900" : "border-slate-300 bg-white text-slate-700",
                )}
              >
                {on ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                {t(`service.${service}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span id="diversion-label" className="font-semibold">
          {t("staff.diversion")}
        </span>
        <Switch checked={h.diversion} tone="warning" labelledBy="diversion-label" disabled={save.isPending} onChange={(diversion) => save.mutate({ diversion })} />
        <span className="text-xs text-slate-600">{h.diversion ? t("staff.diversionOn") : t("staff.diversionOff")}</span>
      </div>
    </section>
  );
}

export function useDiversion(): boolean {
  const hospital = useQuery({ queryKey: HOSPITAL_KEY, queryFn: staff.hospital });
  return Boolean(hospital.data?.diversion);
}
