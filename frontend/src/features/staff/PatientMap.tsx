import { useQuery } from "@tanstack/react-query";
import { Navigation } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MapLegend, MapView } from "@/components/MapView";
import { buttonClasses } from "@/components/ui/Button";
import { staff } from "@/lib/api/endpoints";
import { directionsUrl } from "@/lib/geo";
import { HOSPITAL_KEY } from "./ResourcePanel";

/** Patient location against this hospital, with a directions link for the ambulance team. */
export function PatientMap({ lat, lng, code }: { lat: number; lng: number; code: string }) {
  const { t } = useTranslation();
  const hospital = useQuery({ queryKey: HOSPITAL_KEY, queryFn: staff.hospital });
  const h = hospital.data;
  return (
    <section aria-labelledby="case-map" className="flex flex-col gap-2">
      <h3 id="case-map" className="text-sm font-semibold text-slate-700">
        {t("staff.mapTitle")}
      </h3>
      <div className="overflow-hidden rounded-md border border-slate-200">
        <MapView
          points={[
            { id: "patient", lat, lng, label: code, kind: "patient" },
            ...(h ? [{ id: "hospital", lat: h.lat, lng: h.lng, label: h.name, kind: "hospital-active" as const }] : []),
          ]}
          route={h ? [[h.lat, h.lng], [lat, lng]] : undefined}
          center={[lat, lng]}
          height={200}
          label={t("staff.mapTitle")}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MapLegend items={[{ kind: "patient", label: t("map.legendPatient") }, { kind: "hospital-active", label: t("map.legendYourHospital") }]} />
        <a href={directionsUrl(h ? [h.lat, h.lng] : null, [lat, lng])} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm")}>
          <Navigation className="h-4 w-4" aria-hidden />
          {t("staff.directions")}
        </a>
      </div>
    </section>
  );
}
