import L from "leaflet";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

export type MarkerKind = "patient" | "hospital" | "hospital-active" | "hospital-muted" | "hospital-diversion" | "request" | "request-red";

export interface MapPoint {
  id: string | number;
  lat: number;
  lng: number;
  label: string;
  kind: MarkerKind;
  /** Keep the label visible instead of showing it on hover. */
  pinned?: boolean;
}

export const MARKER_STYLE: Record<MarkerKind, L.CircleMarkerOptions & { radius: number }> = {
  patient: { radius: 8, color: "#FFFFFF", weight: 2, fillColor: "#1D4ED8", fillOpacity: 1 },
  hospital: { radius: 7, color: "#FFFFFF", weight: 2, fillColor: "#0F766E", fillOpacity: 1 },
  "hospital-active": { radius: 9, color: "#FFFFFF", weight: 2, fillColor: "#0F766E", fillOpacity: 1 },
  "hospital-muted": { radius: 6, color: "#FFFFFF", weight: 2, fillColor: "#94A3B8", fillOpacity: 1 },
  "hospital-diversion": { radius: 7, color: "#FFFFFF", weight: 2, fillColor: "#B45309", fillOpacity: 1 },
  request: { radius: 6, color: "#FFFFFF", weight: 2, fillColor: "#1D4ED8", fillOpacity: 0.9 },
  "request-red": { radius: 7, color: "#FFFFFF", weight: 2, fillColor: "#B91C1C", fillOpacity: 1 },
};

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
  useEffect(() => {
    // Wait a tick so the container has its final size, then fit every marker.
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      if (points.length === 1) map.setView([points[0]!.lat, points[0]!.lng], 14);
      if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 14 });
    }, 60);
    return () => window.clearTimeout(timer);
    // Refit only when the set of locations changes, not on every render.
  }, [map, key]);
  return null;
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

interface MapViewProps {
  points: MapPoint[];
  route?: [number, number][];
  onPick?: (lat: number, lng: number) => void;
  center: [number, number];
  height: number;
  label: string;
}

export function MapView({ points, route, onPick, center, height, label }: MapViewProps) {
  const { t } = useTranslation();
  const [tiles, setTiles] = useState({ loaded: 0, failed: 0 });
  const offline = tiles.failed > 0 && tiles.loaded === 0;
  return (
    <div role="region" aria-label={label} style={{ height }} className="relative z-0 w-full bg-slate-100">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileload: () => setTiles((s) => ({ ...s, loaded: s.loaded + 1 })),
            tileerror: () => setTiles((s) => ({ ...s, failed: s.failed + 1 })),
          }}
        />
        <FitBounds points={points} />
        {onPick && <ClickToPick onPick={onPick} />}
        {route && <Polyline positions={route} pathOptions={{ color: "#0F766E", weight: 3, dashArray: "6 6" }} />}
        {points.map((point) => (
          <CircleMarker key={point.id} center={[point.lat, point.lng]} radius={MARKER_STYLE[point.kind].radius} pathOptions={MARKER_STYLE[point.kind]}>
            <Tooltip direction="top" offset={[0, -8]} permanent={point.pinned ?? (point.kind === "patient" || point.kind === "hospital-active")}>
              {point.label}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {offline && (
        <p role="status" className="absolute left-12 right-2 top-2 z-[500] flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-900">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("map.tilesFailed")}
        </p>
      )}
    </div>
  );
}

export function MapLegend({ items }: { items: Array<{ kind: MarkerKind; label: string }> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
      {items.map((item) => (
        <li key={item.kind} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 border-white" style={{ background: MARKER_STYLE[item.kind].fillColor, boxShadow: "0 0 0 1px #CBD5E1" }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
