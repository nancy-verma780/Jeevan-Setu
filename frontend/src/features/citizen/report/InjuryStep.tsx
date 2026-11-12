import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "@/components/ui/cx";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Input";
import type { Sex } from "@/lib/api/types";
import { INJURY_TYPES } from "@/lib/capabilities";
import { INJURY_ICONS } from "../injuryIcons";
import type { ReportDraft, UpdateDraft } from "./draft";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const SEXES: Sex[] = ["female", "male", "other", "unknown"];

export function InjuryStep({ draft, update, showError }: { draft: ReportDraft; update: UpdateDraft; showError: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 id="injury-heading" className="text-xl font-bold">
          {t("report.injuryHeading")}
        </h1>
        <p className="text-slate-700">{t("report.injuryHelper")}</p>
      </div>
      <div role="radiogroup" aria-labelledby="injury-heading" className="grid grid-cols-2 gap-2">
        {INJURY_TYPES.map((type) => {
          const Icon = INJURY_ICONS[type];
          const selected = draft.injuryType === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => update({ injuryType: type })}
              className={cx(
                "flex min-h-[72px] flex-col items-start justify-center gap-1 rounded-lg border p-3 text-left transition-colors",
                selected ? "border-2 border-primary-700 bg-primary-50 text-primary-900" : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
                type === "other" && "col-span-2",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="text-base font-semibold">{t(`injury.${type}`)}</span>
            </button>
          );
        })}
      </div>
      {showError && !draft.injuryType && (
        <p role="alert" className="text-sm font-medium text-danger-700">
          {t("report.chooseInjury")}
        </p>
      )}

      <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4">
        <Checkbox checked={draft.sensitive} onChange={(sensitive) => update({ sensitive })} describedBy="sensitive-hint">
          {t("report.sensitiveLabel")}
        </Checkbox>
        <p id="sensitive-hint" className="pl-9 text-xs text-slate-600">
          {t("report.sensitiveHint")}
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          aria-expanded={draft.detailsOpen}
          aria-controls="patient-details"
          onClick={() => update({ detailsOpen: !draft.detailsOpen })}
          className="flex min-h-tap w-full items-center justify-between px-4 text-left font-semibold text-slate-900"
        >
          <span>
            {t("report.detailsToggle")} <span className="font-normal text-slate-600">({t("common.optional")})</span>
          </span>
          {draft.detailsOpen ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
        </button>
        {draft.detailsOpen && (
          <div id="patient-details" className="flex flex-col gap-4 border-t border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("report.age")}>
                {({ id }) => <Input id={id} inputMode="numeric" value={draft.age} onChange={(e) => update({ age: e.target.value.replace(/\D/g, "").slice(0, 3) })} />}
              </Field>
              <Field label={t("report.sex")}>
                {({ id }) => (
                  <Select id={id} value={draft.sex} onChange={(e) => update({ sex: e.target.value as Sex })}>
                    {SEXES.map((s) => (
                      <option key={s} value={s}>
                        {t(`sex.${s}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field label={t("report.description")} hint={t("report.descriptionHint")}>
              {({ id, describedBy }) => (
                <Textarea id={id} aria-describedby={describedBy} maxLength={1000} value={draft.description} onChange={(e) => update({ description: e.target.value })} />
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("report.bloodGroup")}>
                {({ id }) => (
                  <Select id={id} value={draft.bloodGroup} onChange={(e) => update({ bloodGroup: e.target.value })}>
                    <option value="">{t("common.notGiven")}</option>
                    {BLOOD_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t("report.allergies")}>
                {({ id }) => (
                  <Input id={id} maxLength={200} placeholder={t("report.allergiesHint")} value={draft.allergies} onChange={(e) => update({ allergies: e.target.value })} />
                )}
              </Field>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
