import { ChevronDown, ChevronUp, Clock, Navigation } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SimulatedTag } from "@/components/SimulatedTag";
import { buttonClasses } from "@/components/ui/Button";
import type { CurrentHospital, InjuryType } from "@/lib/api/types";
import { formatCountdown, formatKm } from "@/lib/format";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { WhyPanel } from "./WhyPanel";

export function WaitingCard({ hospital, injuryType }: { hospital: CurrentHospital; injuryType: InjuryType }) {
  const { t } = useTranslation();
  const [whyOpen, setWhyOpen] = useState(false);
  const left = useCountdown(hospital.seconds_left, hospital.assignment_id);
  return (
    <section aria-live="polite" className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-slate-600">{t("status.waitingFor")}</span>
          <span className="text-lg font-bold">{hospital.name}</span>
          <span className="text-sm text-slate-600">{t("common.km", { value: formatKm(hospital.terms.distance_km) })}</span>
        </div>
        {hospital.is_simulated && <SimulatedTag />}
      </div>
      <div className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2">
        <Clock className="h-5 w-5 text-slate-700" aria-hidden />
        <span className="tabular font-semibold">{left > 0 ? t("status.replyDue", { time: formatCountdown(left) }) : t("status.dueOver")}</span>
      </div>
      <p className="text-sm text-slate-800">{t("status.reassure")}</p>
      <button
        type="button"
        aria-expanded={whyOpen}
        aria-controls="why-panel"
        onClick={() => setWhyOpen(!whyOpen)}
        className="flex min-h-[44px] items-center justify-between text-sm font-semibold text-primary-700"
      >
        {t("status.why")}
        {whyOpen ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
      </button>
      {whyOpen && <WhyPanel hospital={hospital} injuryType={injuryType} />}
    </section>
  );
}

export function AcceptedCard({
  hospital,
  code,
  from,
  to,
}: {
  hospital: CurrentHospital;
  code: string;
  from: [number, number];
  to: [number, number] | null;
}) {
  const { t } = useTranslation();
  const directions = to
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from[0]},${from[1]};${to[0]},${to[1]}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(hospital.address ?? hospital.name)}`;
  return (
    <section role="status" className="flex flex-col gap-3 rounded-lg border border-success-300 bg-white p-4">
      <span className="flex items-center gap-2 font-bold text-success-800">{t("status.acceptedTitle")}</span>
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg font-bold">{hospital.name}</span>
        {hospital.is_simulated && <SimulatedTag />}
      </div>
      <p className="text-sm text-slate-800">{t("status.acceptedBody", { code })}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-600">{t("status.address")}</dt>
        <dd className="m-0">{hospital.address}</dd>
        <dt className="text-slate-600">{t("status.phone")}</dt>
        <dd className="m-0">
          <a href={`tel:${(hospital.phone ?? "").replace(/\s/g, "")}`} className="font-semibold text-primary-700">
            {hospital.phone}
          </a>
        </dd>
      </dl>
      <a href={directions} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "md")}>
        <Navigation className="h-5 w-5" aria-hidden />
        {t("status.directions")}
      </a>
    </section>
  );
}
