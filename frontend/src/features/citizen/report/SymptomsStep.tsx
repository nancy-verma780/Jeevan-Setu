import { useTranslation } from "react-i18next";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { RED_FLAG_FIELDS, SYMPTOM_FIELDS, type Answer, type SymptomField } from "@/lib/api/types";
import type { ReportDraft, UpdateDraft } from "./draft";

const OTHER_FIELDS = SYMPTOM_FIELDS.filter((f) => !RED_FLAG_FIELDS.includes(f));

export function SymptomsStep({ draft, update }: { draft: ReportDraft; update: UpdateDraft }) {
  const { t } = useTranslation();
  const options: SegmentOption<Answer>[] = [
    { value: "yes", label: t("answer.yes") },
    { value: "no", label: t("answer.no") },
    { value: "unknown", label: t("answer.unknown"), neutral: true },
  ];

  function answer(field: SymptomField, value: Answer) {
    const patch: Partial<ReportDraft> = { answers: { ...draft.answers, [field]: value } };
    if (value === "yes" && RED_FLAG_FIELDS.includes(field)) {
      patch.redDismissed = false;
      patch.lastRed = field;
    }
    update(patch);
  }

  const group = (title: string, id: string, fields: readonly SymptomField[]) => (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-sm font-semibold text-slate-700">
        {title}
      </h2>
      {fields.map((field) => (
        <div key={field} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <p id={`q-${field}`} className="font-medium">
            {t(`symptom.${field}`)}
          </p>
          <SegmentedControl value={draft.answers[field]} options={options} onChange={(v) => answer(field, v)} labelledBy={`q-${field}`} />
        </div>
      ))}
    </section>
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">{t("report.symptomsHeading")}</h1>
        <p className="text-slate-700">{t("report.symptomsHelper")}</p>
      </div>
      {group(t("report.groupDanger"), "grp-danger", RED_FLAG_FIELDS)}
      {group(t("report.groupOther"), "grp-other", OTHER_FIELDS)}
    </>
  );
}
