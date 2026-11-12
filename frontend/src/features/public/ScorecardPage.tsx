import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";
import { publicApi } from "@/lib/api/endpoints";
import type { HospitalStat } from "@/lib/api/types";
import { formatTime } from "@/lib/format";
import { PublicLayout } from "./PublicLayout";

export const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
export const secs = (v: number | null) => (v === null ? "—" : `${Math.round(v)} s`);

/** Public accountability scorecard: totals only, no case data. */
export function ScorecardPage() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ["scorecard"], queryFn: publicApi.scorecard, refetchInterval: 30_000 });
  return (
    <PublicLayout wide>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{t("scorecard.title")}</h1>
        <p className="text-sm text-slate-700">{t("scorecard.sub")}</p>
      </div>
      {query.isPending && <TableSkeleton rows={5} columns={5} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data && (
        <>
          <Table<HospitalStat>
            caption={t("scorecard.title")}
            minWidth={640}
            rows={query.data.hospitals}
            rowKey={(r) => r.name}
            columns={[
              { key: "name", header: t("admin.colHospital"), cell: (r) => <span className="font-semibold">{r.name}</span> },
              { key: "asked", header: t("admin.colAsked2"), align: "right", cell: (r) => r.asked },
              { key: "accepted", header: t("admin.colAccepted"), align: "right", cell: (r) => r.accepted },
              { key: "rate", header: t("admin.colAcceptRate"), align: "right", cell: (r) => pct(r.accept_rate) },
              { key: "reply", header: t("admin.colMedianReply"), align: "right", cell: (r) => secs(r.median_reply_seconds) },
            ]}
          />
          <p className="text-xs text-slate-600">{t("scorecard.updated", { time: formatTime(query.data.updated_at) })}</p>
        </>
      )}
    </PublicLayout>
  );
}
