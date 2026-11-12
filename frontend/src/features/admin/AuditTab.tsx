import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Column } from "@/components/ui/Table";
import { admin, query as qs } from "@/lib/api/endpoints";
import type { AuditRow } from "@/lib/api/types";
import { formatStamp } from "@/lib/format";
import { FILTER_CONTROL, FilterField, TableShell } from "./TableShell";

const ACTIONS = ["LOGIN", "LOGOUT", "VIEW_CASE", "IMAGE_VIEW", "DECISION_ACCEPT", "DECISION_DECLINE", "ACCESS_DENIED", "UPDATE_RESOURCES", "EXPORT_CSV"];

export function AuditTab() {
  const { t } = useTranslation();
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const q = qs({ action, actor_user_id: actor.replace(/\D/g, ""), date_from: from, date_to: to });
  const query = useQuery({ queryKey: ["admin-audit", q], queryFn: () => admin.audit(q) });

  const columns: Column<AuditRow>[] = [
    { key: "time", header: t("admin.colTime"), cell: (r) => <span className="tabular">{formatStamp(r.created_at, true)}</span> },
    { key: "actor", header: t("admin.colActor"), cell: (r) => (r.actor_user_id === null ? "—" : `#${r.actor_user_id}`) },
    { key: "action", header: t("admin.colAction"), cell: (r) => <code className="text-xs">{r.action}</code> },
    { key: "entity", header: t("admin.colEntity"), cell: (r) => `${r.entity_type} #${r.entity_id}` },
  ];

  return (
    <TableShell
      caption={t("admin.tabAudit")}
      query={query}
      columns={columns}
      rowKey={(r) => r.id}
      csvHref={admin.csvUrl("audit", q)}
      filters={
        <>
          <FilterField label={t("admin.filterAction")}>
            {(id) => (
              <select id={id} className={FILTER_CONTROL} value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">{t("admin.any")}</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            )}
          </FilterField>
          <FilterField label={t("admin.filterActor")}>{(id) => <input id={id} inputMode="numeric" className={`${FILTER_CONTROL} w-24`} value={actor} onChange={(e) => setActor(e.target.value)} />}</FilterField>
          <FilterField label={t("admin.filterFrom")}>{(id) => <input id={id} type="date" className={FILTER_CONTROL} value={from} onChange={(e) => setFrom(e.target.value)} />}</FilterField>
          <FilterField label={t("admin.filterTo")}>{(id) => <input id={id} type="date" className={FILTER_CONTROL} value={to} onChange={(e) => setTo(e.target.value)} />}</FilterField>
        </>
      }
    />
  );
}
