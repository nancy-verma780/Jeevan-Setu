import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/Skeleton";
import { InlineError } from "@/components/ui/States";
import { Timeline } from "@/components/ui/Timeline";
import { publicApi } from "@/lib/api/endpoints";
import { formatDateTime, formatTime } from "@/lib/format";
import { RequestStatusBadge } from "@/features/citizen/RequestStatusBadge";
import { PublicLayout } from "./PublicLayout";

/** Family view of a shared request: status and hospital only, no patient details. */
export function TrackPage() {
  const { t, i18n } = useTranslation();
  const token = useParams().token ?? "";
  const query = useQuery({ queryKey: ["track", token], queryFn: () => publicApi.track(token), refetchInterval: 15_000, retry: false });
  return (
    <PublicLayout>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{t("track.title")}</h1>
        <p className="text-sm text-slate-700">{t("track.sub")}</p>
      </div>
      {query.isPending && <Skeleton className="h-48" />}
      {query.isError && <InlineError>{t("track.expired")}</InlineError>}
      {query.data && (
        <>
          <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="tabular font-bold">{query.data.public_code}</span>
              <RequestStatusBadge status={query.data.status} />
            </div>
            {query.data.hospital && (
              <p className="flex items-start gap-2">
                {query.data.hospital.accepted ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-success-700" aria-hidden /> : <Clock className="mt-0.5 h-5 w-5 text-slate-600" aria-hidden />}
                <span className="flex flex-col">
                  <span className="font-semibold">{query.data.hospital.accepted ? t("track.accepted", { name: query.data.hospital.name }) : t("track.waiting", { name: query.data.hospital.name })}</span>
                  {query.data.hospital.address && <span className="text-sm text-slate-600">{t("track.address", { address: query.data.hospital.address })}</span>}
                </span>
              </p>
            )}
          </section>
          <section aria-labelledby="track-tl" className="flex flex-col gap-3">
            <h2 id="track-tl" className="text-sm font-semibold text-slate-700">
              {t("track.timeline")}
            </h2>
            <Timeline
              items={[...query.data.events].reverse().map((e) => ({
                id: e.id,
                time: formatTime(e.created_at, true),
                title: t(`events.${e.type}`, { name: e.hospital_name ?? "", label: "" }),
                tone: e.type === "HOSPITAL_ACCEPTED" || e.type === "PATIENT_ARRIVED" ? "success" : e.type === "NO_SUITABLE_HOSPITAL" ? "danger" : "default",
              }))}
            />
          </section>
          <p className="flex items-start gap-2 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            {t("track.noDetails")} {t("track.expiresAt", { time: formatDateTime(query.data.expires_at, i18n.language, t("common.today")) })}
          </p>
        </>
      )}
    </PublicLayout>
  );
}
