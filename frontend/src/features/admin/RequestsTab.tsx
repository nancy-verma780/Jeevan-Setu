import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import type { Column } from "@/components/ui/Table";
import { admin, query as qs } from "@/lib/api/endpoints";
import type { AdminRequestRow, Priority, RequestStatus } from "@/lib/api/types";
import { formatStamp } from "@/lib/format";
import { FILTER_CONTROL, FilterField, TableShell } from "./TableShell";

const STATUSES: RequestStatus[] = ["SUBMITTED", "FINDING_HOSPITAL", "AWAITING_HOSPITAL_RESPONSE", "HOSPITAL_ACCEPTED", "PATIENT_ARRIVED", "NO_SUITABLE_HOSPITAL", "CANCELLED"];
const PRIORITIES: Priority[] = ["RED_FLAG", "NEEDS_REVIEW", "ELEVATED", "STANDARD"];

export function RequestsTab() {
  const { t } = useTranslation();
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [code, setCode] = useState("");
  const q = qs({ status, priority, date_from: from, date_to: to, q: code.trim() });
  const query = useQuery({ queryKey: ["admin-requests", q], queryFn: () => admin.requests(q) });

  const columns: Column<AdminRequestRow>[] = [
    { key: "code", header: t("admin.colCode"), cell: (r) => <span className="tabular font-semibold">{r.public_code}</span> },
    { key: "created", header: t("admin.colCreated"), cell: (r) => <span className="tabular">{formatStamp(r.created_at)}</span> },
    { key: "injury", header: t("staff.colInjury"), cell: (r) => t(`injury.${r.injury_type}`) },
    { key: "priority", header: t("admin.filterPriority"), cell: (r) => <PriorityBadge priority={r.priority} /> },
    { key: "status", header: t("admin.filterStatus"), cell: (r) => t(`requestStatus.${r.status}`) },
    { key: "asked", header: t("admin.colAsked"), align: "right", cell: (r) => r.hospitals_asked },
    { key: "current", header: t("admin.colCurrent"), cell: (r) => r.current_hospital ?? "—" },
    {
      key: "trust",
      header: t("admin.colTrust"),
      align: "right",
      cell: (r) =>
        r.reporter_trust === undefined ? "—" : (
          <Badge tone={r.reporter_trust >= 70 ? "success" : r.reporter_trust >= 40 ? "warning" : "danger"}>
            {r.reporter_trust} {t(r.reporter_trust >= 70 ? "admin.trustHigh" : r.reporter_trust >= 40 ? "admin.trustMedium" : "admin.trustLow")}
          </Badge>
        ),
    },
    {
      key: "report",
      header: t("admin.colReport"),
      cell: (r) => (
        <span className="flex items-center gap-2">
          <Link to={`/admin/requests/${r.id}/report`} className="font-semibold text-primary-700">
            {t("admin.colReport")}
          </Link>
          {r.sensitive && <Badge tone="info">{t("staff.sensitive")}</Badge>}
        </span>
      ),
    },
  ];

  return (
    <TableShell
      caption={t("admin.tabRequests")}
      query={query}
      columns={columns}
      rowKey={(r) => r.id}
      csvHref={admin.csvUrl("requests", q)}
      filters={
        <>
          <FilterField label={t("admin.filterStatus")}>
            {(id) => (
              <select id={id} className={FILTER_CONTROL} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t("admin.any")}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`requestStatus.${s}`)}
                  </option>
                ))}
              </select>
            )}
          </FilterField>
          <FilterField label={t("admin.filterPriority")}>
            {(id) => (
              <select id={id} className={FILTER_CONTROL} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">{t("admin.any")}</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`priority.${p}`)}
                  </option>
                ))}
              </select>
            )}
          </FilterField>
          <FilterField label={t("admin.filterFrom")}>{(id) => <input id={id} type="date" className={FILTER_CONTROL} value={from} onChange={(e) => setFrom(e.target.value)} />}</FilterField>
          <FilterField label={t("admin.filterTo")}>{(id) => <input id={id} type="date" className={FILTER_CONTROL} value={to} onChange={(e) => setTo(e.target.value)} />}</FilterField>
          <FilterField label={t("admin.filterCode")}>
            {(id) => <input id={id} className={FILTER_CONTROL} value={code} placeholder="JS-2611" onChange={(e) => setCode(e.target.value)} />}
          </FilterField>
        </>
      }
    />
  );
}
