import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Call112Button } from "@/components/Call112Button";
import { cx } from "@/components/ui/cx";
import type { InjuryType } from "@/lib/api/types";
import { INJURY_TYPES } from "@/lib/capabilities";
import { BackHeader } from "./BackHeader";
import { CitizenLayout } from "./CitizenLayout";
import { INJURY_ICONS } from "./injuryIcons";

/** Static guidance only. No model output is used here. */
export function FirstAidPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const selected = (INJURY_TYPES as string[]).includes(params.get("injury") ?? "") ? (params.get("injury") as InjuryType) : "road_accident";
  const steps = t(`firstAid.steps.${selected}`, { returnObjects: true }) as string[];

  return (
    <CitizenLayout header={<BackHeader to="/" title={t("firstAid.title")} />}>
      <div role="note" className="flex flex-col gap-3 rounded-lg border border-danger-200 bg-danger-50 p-4">
        <p className="flex items-start gap-2 text-sm font-semibold text-danger-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t("firstAid.callBanner")}
        </p>
        <Call112Button variant="solid" />
      </div>

      <section aria-labelledby="fa-choose" className="flex flex-col gap-2">
        <h1 id="fa-choose" className="text-sm font-semibold text-slate-700">
          {t("firstAid.choose")}
        </h1>
        <div className="flex flex-wrap gap-2">
          {INJURY_TYPES.map((type) => {
            const Icon = INJURY_ICONS[type];
            const active = type === selected;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => setParams({ injury: type }, { replace: true })}
                className={cx(
                  "flex min-h-tap items-center gap-2 rounded-md border px-3 text-sm font-medium",
                  active ? "border-primary-700 bg-primary-50 text-primary-900" : "border-slate-300 bg-white text-slate-800",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t(`injury.${type}`)}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="fa-steps" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 id="fa-steps" className="mb-3 text-lg font-bold">
          {t(`injury.${selected}`)}
        </h2>
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
              <span className="tabular flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-900">{index + 1}</span>
              <span className="text-base text-slate-900">{step}</span>
            </li>
          ))}
        </ol>
      </section>
      <p className="text-sm text-slate-600">{t("firstAid.notAdvice")}</p>
    </CitizenLayout>
  );
}
