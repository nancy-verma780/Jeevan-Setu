import { Check } from "lucide-react";
import { FreshnessText } from "@/components/FreshnessText";
import { useTranslation } from "react-i18next";
import type { CurrentHospital, InjuryType } from "@/lib/api/types";
import { REQUIRED_SERVICES } from "@/lib/capabilities";
import { RANKING } from "@/lib/config";
import { formatKm, formatScore } from "@/lib/format";

/** Shows the stored terms of Eq. (8) for the hospital the request went to. */
export function WhyPanel({ hospital, injuryType }: { hospital: CurrentHospital; injuryType: InjuryType }) {
  const { t } = useTranslation();
  const { terms } = hospital;
  const distancePart = terms.distance_term / RANKING.wDistance;
  const resourcePart = terms.resource_term / RANKING.wResource;
  const bedsLabel =
    terms.availability_flag === "missing"
      ? t("status.whyBedsMissing")
      : terms.availability_flag === "stale"
        ? t("status.whyBedsStale")
        : t("status.whyBeds", { beds: hospital.free_beds ?? 0, cap: RANKING.bedCap });

  const rows: Array<[string, string]> = [
    [t("status.whyDistance", { km: formatKm(terms.distance_km), max: RANKING.maxDistanceKm }), `${formatScore(distancePart)} × ${RANKING.wDistance} = ${formatScore(terms.distance_term)}`],
    [bedsLabel, `${resourcePart.toFixed(2)} × ${RANKING.wResource} = ${formatScore(terms.resource_term)}`],
    [t("status.whyReliability"), `+ ${formatScore(terms.reliability_term)}`],
  ];

  return (
    <div id="why-panel" className="flex flex-col gap-3 border-t border-slate-200 pt-3 text-sm">
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-700">{label}</dt>
            <dd className="tabular m-0 text-right font-semibold">{value}</dd>
          </div>
        ))}
        <dt className="border-t border-slate-200 pt-1 font-semibold">{t("status.whyScore")}</dt>
        <dd className="tabular m-0 border-t border-slate-200 pt-1 text-right font-bold">{formatScore(terms.score)}</dd>
      </dl>
      {hospital.freshness && (
        <p className="flex flex-wrap items-center gap-x-2">
          <span className="text-slate-700">{t("freshness.label")}:</span>
          <FreshnessText freshness={hospital.freshness} />
        </p>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-slate-700">{t("status.whyServices")}</span>
        <ul className="flex flex-wrap gap-1">
          {REQUIRED_SERVICES[injuryType].map((service) => (
            <li key={service} className="inline-flex items-center gap-1 rounded border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs text-primary-900">
              <Check className="h-3 w-3" aria-hidden />
              {t(`service.${service}`)}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-slate-600">{t("status.whyNote")}</p>
    </div>
  );
}
