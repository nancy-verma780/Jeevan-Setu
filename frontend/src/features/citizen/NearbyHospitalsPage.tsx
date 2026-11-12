import { useQuery } from "@tanstack/react-query";
import { Crosshair, Navigation, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapLegend, MapView, type MapPoint } from "@/components/MapView";
import { SimulatedTag } from "@/components/SimulatedTag";
import { Button, buttonClasses } from "@/components/ui/Button";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { hospitals } from "@/lib/api/endpoints";
import { DEFAULT_MAP_CENTER } from "@/lib/config";
import { formatKm } from "@/lib/format";
import { directionsUrl, haversineKm } from "@/lib/geo";
import { BackHeader } from "./BackHeader";
import { CitizenLayout } from "./CitizenLayout";

type Origin = { lat: number; lng: number; fromGps: boolean };

/** Browse nearby hospitals on a map. Reporting an emergency still goes through the report flow. */
export function NearbyHospitalsPage() {
  const { t } = useTranslation();
  const pins = useQuery({ queryKey: ["hospital-pins"], queryFn: hospitals.pins, staleTime: 300_000 });
  const [origin, setOrigin] = useState<Origin>({ lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1], fromGps: false });
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  function locate() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude, fromGps: true });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  useEffect(locate, []);

  const list = (pins.data ?? [])
    .map((h) => ({ ...h, km: haversineKm(origin.lat, origin.lng, h.lat, h.lng) }))
    .sort((a, b) => a.km - b.km);
  const chosen = list.find((h) => h.id === selected);

  const points: MapPoint[] = [
    { id: "you", lat: origin.lat, lng: origin.lng, label: t("map.you"), kind: "patient" },
    ...list.map((h) => ({
      id: h.id,
      lat: h.lat,
      lng: h.lng,
      label: h.name,
      kind: h.diversion ? ("hospital-diversion" as const) : h.id === selected ? ("hospital-active" as const) : ("hospital" as const),
      pinned: h.id === selected,
    })),
  ];

  return (
    <CitizenLayout header={<BackHeader to="/" title={t("nearby.title")} />}>
      <section className="-mx-4 -mt-6 flex flex-col gap-2 border-b border-slate-200 bg-white pb-3">
        <MapView
          points={points}
          route={chosen ? [[origin.lat, origin.lng], [chosen.lat, chosen.lng]] : undefined}
          center={[origin.lat, origin.lng]}
          height={260}
          label={t("nearby.title")}
        />
        <div className="flex flex-col gap-2 px-4">
          <MapLegend
            items={[
              { kind: "patient", label: t("map.you") },
              { kind: "hospital", label: t("map.legendHospital") },
              { kind: "hospital-diversion", label: t("map.legendDiversion") },
            ]}
          />
          {!origin.fromGps && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-600">{t("nearby.usingDefault")}</p>
              <Button variant="secondary" size="sm" icon={Crosshair} loading={locating} onClick={locate}>
                {t("nearby.useMyLocation")}
              </Button>
            </div>
          )}
        </div>
      </section>

      <p className="text-sm text-slate-700">{t("nearby.sub")}</p>

      {pins.isPending && <ListSkeleton rows={3} />}
      {pins.isError && <ErrorState error={pins.error} onRetry={() => void pins.refetch()} />}
      {pins.data && list.length === 0 && <EmptyState title={t("nearby.empty")} />}
      {list.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.map((h) => (
            <li key={h.id}>
              <article className={`flex flex-col gap-3 rounded-lg border bg-white p-4 ${h.id === selected ? "border-primary-700" : "border-slate-200"}`}>
                <button type="button" onClick={() => setSelected(h.id === selected ? null : h.id)} aria-pressed={h.id === selected} className="flex items-start justify-between gap-3 text-left">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-semibold text-slate-900">{h.name}</span>
                    <span className="text-sm text-slate-600">{h.address}</span>
                  </span>
                  <span className="tabular shrink-0 text-sm font-semibold text-slate-900">{t("common.km", { value: formatKm(h.km) })}</span>
                </button>
                <ul className="flex flex-wrap gap-1">
                  {h.services.map((s) => (
                    <li key={s} className="rounded border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs text-primary-900">
                      {t(`service.${s}`)}
                    </li>
                  ))}
                  {h.diversion && <li className="rounded border border-warning-200 bg-warning-50 px-2 py-0.5 text-xs text-warning-900">{t("map.legendDiversion")}</li>}
                  {h.is_simulated && <SimulatedTag />}
                </ul>
                <div className="grid grid-cols-2 gap-2">
                  <a href={`tel:${h.phone.replace(/\s/g, "")}`} className={buttonClasses("secondary", "sm")}>
                    <Phone className="h-4 w-4" aria-hidden />
                    {t("nearby.call")}
                  </a>
                  <a href={directionsUrl(origin.fromGps ? [origin.lat, origin.lng] : null, [h.lat, h.lng])} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm")}>
                    <Navigation className="h-4 w-4" aria-hidden />
                    {t("nearby.directions")}
                  </a>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-600">{t("nearby.notice")}</p>
    </CitizenLayout>
  );
}
