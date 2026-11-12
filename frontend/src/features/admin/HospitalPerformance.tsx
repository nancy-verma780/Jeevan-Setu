import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Table } from "@/components/ui/Table";
import { admin } from "@/lib/api/endpoints";
import type { HospitalStat } from "@/lib/api/types";
import { pct, secs } from "@/features/public/ScorecardPage";

/** Accept rate and reply speed per hospital (from the overview endpoint). */
export function HospitalPerformance() {
  const { t } = useTranslation();
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: admin.overview });
  const rows = overview.data?.per_hospital;
  if (!rows) return null;
  return (
    <section aria-labelledby="perf-title" className="flex flex-col gap-2">
      <h2 id="perf-title" className="font-bold">
        {t("admin.perHospital")}
      </h2>
      <HospitalStatsTable rows={rows} />
    </section>
  );
}

export function HospitalStatsTable({ rows }: { rows: HospitalStat[] }) {
  const { t } = useTranslation();
  return (
    <Table<HospitalStat>
      caption={t("admin.perHospital")}
      minWidth={720}
      rows={rows}
      rowKey={(r) => r.name}
      columns={[
        { key: "name", header: t("admin.colHospital"), cell: (r) => <span className="font-semibold">{r.name}</span> },
        { key: "asked", header: t("admin.colAsked2"), align: "right", cell: (r) => r.asked },
        { key: "acc", header: t("admin.colAccepted"), align: "right", cell: (r) => r.accepted },
        { key: "dec", header: t("admin.colDeclined"), align: "right", cell: (r) => r.declined },
        { key: "to", header: t("admin.colTimedOut"), align: "right", cell: (r) => r.timed_out },
        { key: "rate", header: t("admin.colAcceptRate"), align: "right", cell: (r) => pct(r.accept_rate) },
        { key: "reply", header: t("admin.colMedianReply"), align: "right", cell: (r) => secs(r.median_reply_seconds) },
      ]}
    />
  );
}
