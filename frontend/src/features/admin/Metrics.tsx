import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { admin } from "@/lib/api/endpoints";
import type { RequestStatus } from "@/lib/api/types";

const STATUS_ORDER: RequestStatus[] = [
  "AWAITING_HOSPITAL_RESPONSE",
  "HOSPITAL_ACCEPTED",
  "PATIENT_ARRIVED",
  "NO_SUITABLE_HOSPITAL",
  "CANCELLED",
  "FINDING_HOSPITAL",
  "SUBMITTED",
];

export function Metrics() {
  const { t } = useTranslation();
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: admin.overview, refetchInterval: 30_000 });
  if (overview.isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />;
  const o = overview.data;
  const tile = "flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4";
  return (
    <section aria-label={t("admin.title")} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className={tile}>
        <span className="text-sm text-slate-600">{t("admin.totalRequests")}</span>
        <span className="tabular text-xl font-bold">{o.total_requests}</span>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 text-xs text-slate-700">
          {STATUS_ORDER.filter((s) => o.by_status[s] > 0).map((s) => (
            <div key={s} className="contents">
              <dt className="truncate">{t(`requestStatus.${s}`)}</dt>
              <dd className="tabular m-0 text-right">{o.by_status[s]}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={tile}>
        <span className="text-sm text-slate-600">{t("admin.medianResponse")}</span>
        <span className="tabular text-xl font-bold">
          {o.median_response_seconds === null ? t("admin.noData") : t("admin.seconds", { value: Math.round(o.median_response_seconds) })}
        </span>
      </div>
      <div className={tile}>
        <span className="text-sm text-slate-600">{t("admin.acceptRate")}</span>
        <span className="tabular text-xl font-bold">{o.accept_rate === null ? t("admin.noData") : `${Math.round(o.accept_rate * 100)}%`}</span>
      </div>
      <div className={tile}>
        <span className="text-sm text-slate-600">{t("admin.noHospital")}</span>
        <span className="tabular text-xl font-bold">{o.no_hospital_cases}</span>
      </div>
    </section>
  );
}
