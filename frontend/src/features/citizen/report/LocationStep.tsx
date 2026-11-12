import { useQuery } from "@tanstack/react-query";
import { Crosshair, MapPin } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapView, type MapPoint } from "@/components/MapView";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input } from "@/components/ui/Input";
import { CONSENT_POLICY_VERSION, DEFAULT_MAP_CENTER } from "@/lib/config";
import { hospitals, passport } from "@/lib/api/endpoints";
import type { ReportDraft, UpdateDraft } from "./draft";

type GpsState = "idle" | "working" | "failed" | "denied";

export function LocationStep({ draft, update, showErrors }: { draft: ReportDraft; update: UpdateDraft; showErrors: boolean }) {
  const { t } = useTranslation();
  const [gps, setGps] = useState<GpsState>("idle");
  const [manualOpen, setManualOpen] = useState(draft.location?.source === "manual");
  const [lat, setLat] = useState(draft.location ? String(draft.location.lat) : "");
  const [lng, setLng] = useState(draft.location ? String(draft.location.lng) : "");
  const [manualError, setManualError] = useState(false);
  const pins = useQuery({ queryKey: ["hospital-pins"], queryFn: hospitals.pins, staleTime: 300_000 });
  const myPassport = useQuery({ queryKey: ["passport"], queryFn: passport.get, staleTime: 300_000 });

  function useGps() {
    if (!("geolocation" in navigator)) {
      setGps("failed");
      return;
    }
    setGps("working");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps("idle");
        update({ location: { lat: position.coords.latitude, lng: position.coords.longitude, source: "gps" } });
      },
      (error) => setGps(error.code === error.PERMISSION_DENIED ? "denied" : "failed"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function useManual() {
    const la = Number.parseFloat(lat);
    const lo = Number.parseFloat(lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
      setManualError(true);
      return;
    }
    setManualError(false);
    update({ location: { lat: la, lng: lo, source: "manual" } });
  }

  const points: MapPoint[] = [
    ...(pins.data ?? []).map((h) => ({ id: `h${h.id}`, lat: h.lat, lng: h.lng, label: h.name, kind: "hospital" as const })),
    ...(draft.location ? [{ id: "patient", lat: draft.location.lat, lng: draft.location.lng, label: t("status.you"), kind: "patient" as const }] : []),
  ];

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">{t("report.locationHeading")}</h1>
        <p className="text-slate-700">{t("report.locationHelper")}</p>
      </div>

      <Button variant="secondary" size="lg" icon={Crosshair} loading={gps === "working"} onClick={useGps}>
        {gps === "working" ? t("report.gpsWorking") : t("report.useGps")}
      </Button>
      {(gps === "failed" || gps === "denied") && (
        <p role="alert" className="text-sm font-medium text-danger-700">
          {gps === "denied" ? t("report.gpsDenied") : t("report.gpsFailed")}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-700">{t("report.mapHint")}</p>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <MapView
            points={points.filter((p) => p.kind === "patient")}
            center={draft.location ? [draft.location.lat, draft.location.lng] : DEFAULT_MAP_CENTER}
            height={240}
            label={t("report.mapLabel")}
            onPick={(la, lo) => update({ location: { lat: la, lng: lo, source: "map_pin" } })}
          />
        </div>
      </div>

      {draft.location ? (
        <p role="status" className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          {t("report.locationChosen", { source: t(`report.locationFrom_${draft.location.source}`) })}
          <span className="tabular ml-auto text-xs">
            {draft.location.lat.toFixed(5)}, {draft.location.lng.toFixed(5)}
          </span>
        </p>
      ) : (
        showErrors && (
          <p role="alert" className="text-sm font-medium text-danger-700">
            {t("report.locationMissing")}
          </p>
        )
      )}

      <section className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          aria-expanded={manualOpen}
          aria-controls="manual-coords"
          onClick={() => setManualOpen(!manualOpen)}
          className="min-h-tap w-full px-4 text-left font-semibold"
        >
          {t("report.manualToggle")}
        </button>
        {manualOpen && (
          <div id="manual-coords" className="flex flex-col gap-3 border-t border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("report.latitude")}>
                {({ id }) => <Input id={id} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />}
              </Field>
              <Field label={t("report.longitude")}>
                {({ id }) => <Input id={id} inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />}
              </Field>
            </div>
            {manualError && (
              <p role="alert" className="text-sm font-medium text-danger-700">
                {t("report.manualInvalid")}
              </p>
            )}
            <Button variant="secondary" onClick={useManual}>
              {t("report.useManual")}
            </Button>
          </div>
        )}
      </section>

      {myPassport.data && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <Checkbox checked={draft.sharePassport} onChange={(sharePassport) => update({ sharePassport })}>
            {t("passport.shareLabel")}
          </Checkbox>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <Checkbox checked={draft.consent} onChange={(consent) => update({ consent })} invalid={showErrors && !draft.consent} describedBy="consent-version">
          {t("report.consentLabel")}
        </Checkbox>
        <p id="consent-version" className="pl-9 text-xs text-slate-600">
          {t("report.consentVersion", { version: CONSENT_POLICY_VERSION })}
        </p>
        {showErrors && !draft.consent && (
          <p role="alert" className="pl-9 text-sm font-medium text-danger-700">
            {t("report.consentMissing")}
          </p>
        )}
      </div>
    </>
  );
}
