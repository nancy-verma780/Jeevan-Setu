import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { admin } from "@/lib/api/endpoints";
import { formatKm, formatScore, formatStamp } from "@/lib/format";

const secondsBetween = (a: string, b: string | null) => (b ? Math.round((Date.parse(b) - Date.parse(a)) / 1000) : null);

/** Post-incident report for one case. Use the browser's print dialog to save it as PDF. */
export function CaseReportPage() {
  const { t } = useTranslation();
  const id = Number(useParams().id);
  const query = useQuery({ queryKey: ["case-report", id], queryFn: () => admin.caseReport(id) });
  if (query.isPending) return <Skeleton className="m-8 h-96" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} className="m-8" />;
  const r = query.data;
  const answer = (a: string) => (a === "yes" ? t("common.yes") : a === "no" ? t("common.no") : t("feedback.unsure"));
  const th = "border-b border-slate-300 px-2 py-1 text-left font-semibold";
  const td = "border-b border-slate-200 px-2 py-1 align-top";
  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-6 bg-white p-8 text-sm text-slate-900 print:p-0">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link to="/admin" className="font-semibold text-primary-700">
          ← {t("common.back")}
        </Link>
        <Button icon={Printer} onClick={() => window.print()}>
          {t("admin.print")}
        </Button>
      </div>
      <header className="flex items-start justify-between gap-4 border-b border-slate-300 pb-4">
        <div className="flex items-center gap-3">
          <LogoMark size={40} />
          <div>
            <h1 className="text-xl font-bold">
              {t("admin.caseReport")}: {r.public_code}
            </h1>
            <p className="text-slate-600">{t("admin.generated", { time: formatStamp(new Date().toISOString()) })}</p>
          </div>
        </div>
        <PriorityBadge priority={r.priority} preliminary />
      </header>
      <dl className="grid grid-cols-[180px_minmax(0,1fr)] gap-x-4 gap-y-1">
        <dt className="text-slate-600">{t("admin.colCreated")}</dt>
        <dd className="m-0">{formatStamp(r.created_at, true)}</dd>
        <dt className="text-slate-600">{t("staff.colInjury")}</dt>
        <dd className="m-0">{t(`injury.${r.injury_type}`)}</dd>
        <dt className="text-slate-600">{t("admin.filterStatus")}</dt>
        <dd className="m-0">{t(`requestStatus.${r.status}`)}</dd>
        <dt className="text-slate-600">{t("staff.priorityTitle", { version: r.rule_set_version })}</dt>
        <dd className="m-0">{r.priority_reasons.map((x) => x.text).join("; ")}</dd>
        {r.sensitive && (
          <>
            <dt className="text-slate-600">{t("staff.sensitive")}</dt>
            <dd className="m-0">{t("common.yes")}</dd>
          </>
        )}
      </dl>
      <section>
        <h2 className="mb-2 font-bold">{t("admin.assignmentsTitle")}</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {[t("admin.colHospital"), t("staff.colDistance"), t("admin.scoreTerms"), t("admin.filterStatus"), t("admin.colMedianReply")].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.assignments.map((a) => (
              <tr key={a.created_at + a.hospital}>
                <td className={td}>{a.hospital}</td>
                <td className={td}>{t("common.km", { value: formatKm(a.distance_km) })}</td>
                <td className={`${td} tabular`}>
                  {formatScore(a.distance_term)} + {formatScore(a.resource_term)} + {formatScore(a.reliability_term)} = <b>{formatScore(a.score)}</b>
                </td>
                <td className={td}>
                  {t(`staff.assignmentStatus.${a.status}`)}
                  {a.reason ? `: ${t(`declineReason.${a.reason}`)}` : ""}
                  {a.arrived_at ? `; ${t("staff.arrivedAt", { time: formatStamp(a.arrived_at, true) })}` : ""}
                </td>
                <td className={`${td} tabular`}>{secondsBetween(a.created_at, a.decided_at) ?? "—"} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="mb-2 font-bold">{t("admin.timelineTitle")}</h2>
        <ol className="flex flex-col gap-1">
          {r.events.map((e) => (
            <li key={e.id} className="grid grid-cols-[170px_minmax(0,1fr)] gap-3">
              <span className="tabular text-slate-600">{formatStamp(e.created_at, true)}</span>
              <span>
                {t(`events.${e.type}`, { name: e.hospital_name ?? "", label: t(`priority.${r.priority}`) })}
                {e.reason ? ` (${t(`declineReason.${e.reason}`)})` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>
      {r.feedback && (
        <section>
          <h2 className="mb-2 font-bold">{t("admin.feedbackTitle")}</h2>
          <p>
            {t("feedback.ready")} {answer(r.feedback.hospital_ready)}. {t("feedback.correct")} {answer(r.feedback.info_correct)}.
            {r.feedback.comment ? ` “${r.feedback.comment}”` : ""}
          </p>
        </section>
      )}
      <p className="border-t border-slate-300 pt-3 text-xs text-slate-600">{t("demo.simulated")}</p>
    </div>
  );
}
