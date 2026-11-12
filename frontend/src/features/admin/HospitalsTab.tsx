import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FreshnessText } from "@/components/FreshnessText";
import { SimulatedTag } from "@/components/SimulatedTag";
import { Switch } from "@/components/ui/Switch";
import type { Column } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { admin } from "@/lib/api/endpoints";
import type { Hospital } from "@/lib/api/types";
import { formatTime } from "@/lib/format";
import { TableShell } from "./TableShell";

export function HospitalsTab() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ["admin-hospitals"], queryFn: admin.hospitals });
  const update = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<Pick<Hospital, "open_for_emergency" | "diversion">> }) => admin.updateHospital(id, changes),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["admin-hospitals"] }),
    onError: () => toast(t("errors.generic"), "error"),
  });

  const columns: Column<Hospital>[] = [
    {
      key: "name",
      header: t("admin.colName"),
      cell: (h) => (
        <span className="flex items-center gap-2 font-semibold">
          {h.name}
          {h.is_simulated && <SimulatedTag />}
        </span>
      ),
    },
    { key: "services", header: t("admin.colServices"), cell: (h) => h.services.map((s) => t(`service.${s}`)).join(", ") },
    {
      key: "beds",
      header: t("admin.colBeds"),
      align: "right",
      cell: (h) => (
        <span className="flex flex-col items-end">
          <span>{h.free_beds === null ? t("staff.bedsNotReported") : `${h.free_beds}${h.beds_updated_at ? ` (${formatTime(h.beds_updated_at)})` : ""}`}</span>
          <FreshnessText freshness={h.freshness} />
        </span>
      ),
    },
    {
      key: "open",
      header: <span id="col-open">{t("admin.colOpen")}</span>,
      cell: (h) => (
        <Switch checked={h.open_for_emergency} labelledBy="col-open" onChange={(v) => update.mutate({ id: h.id, changes: { open_for_emergency: v } })} />
      ),
    },
    {
      key: "diversion",
      header: <span id="col-diversion">{t("admin.colDiversion")}</span>,
      cell: (h) => <Switch checked={h.diversion} tone="warning" labelledBy="col-diversion" onChange={(v) => update.mutate({ id: h.id, changes: { diversion: v } })} />,
    },
  ];

  return <TableShell caption={t("admin.tabHospitals")} query={query} columns={columns} rowKey={(h) => h.id} csvHref={admin.csvUrl("hospitals", "")} />;
}
