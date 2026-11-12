import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MapLegend, MapView, type MapPoint } from "@/components/MapView";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { admin } from "@/lib/api/endpoints";
import { DEFAULT_MAP_CENTER } from "@/lib/config";

const ACTIVE = new Set(["SUBMITTED", "FINDING_HOSPITAL", "AWAITING_HOSPITAL_RESPONSE"]);

export function MapTab() {
  const { t } = useTranslation();
  const hospitalQuery = useQuery({ queryKey: ["admin-hospitals"], queryFn: admin.hospitals });
  const requestQuery = useQuery({ queryKey: ["admin-requests", ""], queryFn: () => admin.requests(""), refetchInterval: 15_000 });
  if (hospitalQuery.isPending || requestQuery.isPending) return <Skeleton className="h-[480px]" />;
  if (hospitalQuery.isError) return <ErrorState error={hospitalQuery.error} onRetry={() => void hospitalQuery.refetch()} />;
  if (requestQuery.isError) return <ErrorState error={requestQuery.error} onRetry={() => void requestQuery.refetch()} />;

  const active = requestQuery.data.filter((r) => ACTIVE.has(r.status));
  const points: MapPoint[] = [
    ...hospitalQuery.data.map((h) => ({
      id: `h${h.id}`,
      lat: h.lat,
      lng: h.lng,
      label: h.name,
      kind: !h.open_for_emergency ? ("hospital-muted" as const) : h.diversion ? ("hospital-diversion" as const) : ("hospital" as const),
      pinned: true,
    })),
    ...active.map((r) => ({
      id: `r${r.id}`,
      lat: r.lat,
      lng: r.lng,
      label: `${r.public_code}: ${t(`priority.${r.priority}`)}`,
      kind: r.priority === "RED_FLAG" ? ("request-red" as const) : ("request" as const),
      pinned: false,
    })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-700">{t("admin.mapNote", { count: active.length })}</p>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <MapView points={points} center={DEFAULT_MAP_CENTER} height={480} label={t("admin.tabMap")} />
      </div>
      <MapLegend
        items={[
          { kind: "hospital", label: t("map.legendHospital") },
          { kind: "hospital-diversion", label: t("map.legendDiversion") },
          { kind: "hospital-muted", label: t("map.legendClosed") },
          { kind: "request", label: t("map.legendRequest") },
          { kind: "request-red", label: t("map.legendRedRequest") },
        ]}
      />
    </div>
  );
}
