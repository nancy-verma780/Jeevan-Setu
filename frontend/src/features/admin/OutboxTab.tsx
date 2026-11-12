import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { admin } from "@/lib/api/endpoints";
import type { OutboxRow } from "@/lib/api/types";
import { formatStamp } from "@/lib/format";
import { TableShell } from "./TableShell";

/** Messages from the pluggable alert providers (all mock in this prototype). */
export function OutboxTab() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ["admin-notifications"], queryFn: admin.notifications });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-700">{t("admin.outboxNote")}</p>
      <TableShell<OutboxRow>
        caption={t("admin.tabOutbox")}
        query={query}
        csvHref={admin.csvUrl("notifications", "")}
        rowKey={(r) => r.id}
        columns={[
          { key: "time", header: t("admin.colTime"), cell: (r) => <span className="tabular">{formatStamp(r.created_at, true)}</span> },
          { key: "ch", header: t("admin.colChannel"), cell: (r) => <Badge>{r.channel}</Badge> },
          { key: "to", header: t("admin.colTo"), cell: (r) => <span className="tabular">{r.to}</span> },
          { key: "msg", header: t("admin.colMessage"), cell: (r) => r.text, className: "max-w-[520px]" },
        ]}
      />
    </div>
  );
}
