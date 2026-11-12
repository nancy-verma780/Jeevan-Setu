import { useMutation, useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, InlineError, useErrorMessage } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";
import { admin } from "@/lib/api/endpoints";
import { RANKING } from "@/lib/config";
import { pct, secs } from "@/features/public/ScorecardPage";
import { FILTER_CONTROL } from "./TableShell";

/** Refusal analytics, area and time-of-day fairness, citizen feedback, and the ranking what-if sandbox. */
export function InsightsTab() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ["admin-insights"], queryFn: admin.insights });
  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const d = query.data;
  const maxReason = Math.max(1, ...d.refusals_by_reason.map((r) => r.count));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-bold">{t("admin.refusals")}</h2>
        {d.refusals_by_reason.length === 0 ? (
          <p className="text-sm text-slate-600">{t("admin.noRefusals")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {d.refusals_by_reason.map((r) => (
              <li key={r.reason} className="grid grid-cols-[160px_minmax(0,1fr)_32px] items-center gap-3 text-sm">
                <span>{t(`declineReason.${r.reason}`)}</span>
                <span className="h-3 rounded-full bg-slate-100">
                  <span className="block h-3 rounded-full bg-warning-600" style={{ width: `${(r.count / maxReason) * 100}%` }} />
                </span>
                <span className="tabular text-right font-semibold">{r.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="font-bold">{t("admin.feedbackTitle")}</h2>
        <p className="text-sm text-slate-700">
          {d.feedback.count === 0
            ? t("admin.noFeedback")
            : t("admin.feedbackSummary", { count: d.feedback.count, ready: pct(d.feedback.hospital_ready_yes), correct: pct(d.feedback.info_correct_yes) })}
        </p>
      </Card>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">{t("admin.byArea")}</h2>
        <Table
          caption={t("admin.byArea")}
          minWidth={420}
          rows={d.by_area}
          rowKey={(r) => r.area}
          columns={[
            { key: "a", header: t("admin.colArea"), cell: (r) => r.area },
            { key: "r", header: t("admin.colRequests"), align: "right", cell: (r) => r.requests },
            { key: "d", header: t("admin.colDeclined"), align: "right", cell: (r) => r.declined },
            { key: "n", header: t("admin.colNoHospital"), align: "right", cell: (r) => r.no_hospital },
          ]}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">{t("admin.byHour")}</h2>
        <Table
          caption={t("admin.byHour")}
          minWidth={420}
          rows={d.by_hour}
          rowKey={(r) => r.hour}
          columns={[
            { key: "h", header: t("admin.colHour"), cell: (r) => `${String(r.hour).padStart(2, "0")}:00` },
            { key: "r", header: t("admin.colRequests"), align: "right", cell: (r) => r.requests },
            { key: "a", header: t("admin.colAcceptRate"), align: "right", cell: (r) => pct(r.accept_rate) },
            { key: "m", header: t("admin.colMedianReply"), align: "right", cell: (r) => secs(r.median_reply_seconds) },
          ]}
        />
      </section>
      <WhatIf />
    </div>
  );
}

function WhatIf() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [w, setW] = useState({ wd: RANKING.wDistance, wr: RANKING.wResource, dmax: RANKING.maxDistanceKm, bcap: RANKING.bedCap });
  const run = useMutation({ mutationFn: () => admin.whatIf(w) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run.mutate();
  };
  const fields: Array<[keyof typeof w, string, number, number, number]> = [
    ["wd", t("admin.wd"), 0, 1, 0.05],
    ["wr", t("admin.wr"), 0, 1, 0.05],
    ["dmax", t("admin.dmax"), 1, 100, 1],
    ["bcap", t("admin.bcap"), 1, 50, 1],
  ];
  const r = run.data;
  return (
    <Card className="flex flex-col gap-4 p-4 lg:col-span-2">
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 h-5 w-5 text-primary-700" aria-hidden />
        <div>
          <h2 className="font-bold">{t("admin.whatIf")}</h2>
          <p className="text-sm text-slate-700">{t("admin.whatIfNote")}</p>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        {fields.map(([key, label, min, max, step]) => (
          <label key={key} className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
            {label}
            <input type="number" min={min} max={max} step={step} value={w[key]} onChange={(e) => setW({ ...w, [key]: Number(e.target.value) })} className={`${FILTER_CONTROL} w-28`} />
          </label>
        ))}
        <Button type="submit" size="sm" loading={run.isPending}>
          {t("admin.run")}
        </Button>
      </form>
      {run.isError && <InlineError>{errorMessage(run.error)}</InlineError>}
      {r && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="font-semibold">{t("admin.whatIfResult", { changed: r.changed, requests: r.requests })}</p>
          <p>{t("admin.noHospitalChange", { before: r.no_hospital_before, after: r.no_hospital_after })}</p>
          <p>{t("admin.avgDistance", { before: r.avg_distance_before ?? "—", after: r.avg_distance_after ?? "—" })}</p>
          {r.examples.length > 0 && (
            <Table
              caption={t("admin.whatIf")}
              minWidth={560}
              rows={r.examples}
              rowKey={(e) => e.code}
              columns={[
                { key: "c", header: t("admin.colCode"), cell: (e) => <span className="tabular">{e.code}</span> },
                { key: "i", header: t("staff.colInjury"), cell: (e) => t(`injury.${e.injury_type}`) },
                { key: "b", header: t("admin.colBefore"), cell: (e) => e.before ?? "—" },
                { key: "a", header: t("admin.colAfter"), cell: (e) => e.after ?? "—" },
              ]}
            />
          )}
        </div>
      )}
    </Card>
  );
}
