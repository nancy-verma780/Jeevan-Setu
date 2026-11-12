import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Modal } from "@/components/ui/Modal";
import { InlineError, useErrorMessage } from "@/components/ui/States";
import { drill as drillApi, emergencies } from "@/lib/api/endpoints";
import { RED_FLAG_FIELDS, SYMPTOM_FIELDS } from "@/lib/api/types";
import { CONSENT_POLICY_VERSION } from "@/lib/config";
import { formatTime } from "@/lib/format";
import { useDraft } from "@/lib/hooks/useDraft";
import { useDrill } from "@/features/drill/DrillContext";
import { BackHeader } from "../BackHeader";
import { CitizenLayout } from "../CitizenLayout";
import { DRAFT_KEY, emptyDraft, parsedAge, toSymptoms, type ReportDraft } from "./draft";
import { InjuryStep } from "./InjuryStep";
import { LocationStep } from "./LocationStep";
import { RedFlagScreen } from "./RedFlagScreen";
import { SymptomsStep } from "./SymptomsStep";

export function ReportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const errorMessage = useErrorMessage();
  const { drill } = useDrill();
  const { value: draft, setValue, savedAt, clear } = useDraft<ReportDraft>(DRAFT_KEY, emptyDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const update = (patch: Partial<ReportDraft>) => setValue((current) => ({ ...current, ...patch }));
  const goTo = (step: ReportDraft["step"]) => {
    setShowErrors(false);
    update({ step });
    window.scrollTo({ top: 0 });
  };

  const submit = useMutation({
    mutationFn: async () => {
      const symptoms = toSymptoms(draft.answers);
      const location = draft.location!;
      if (drill) {
        const preview = await drillApi.preview({ injury_type: draft.injuryType!, symptoms, location, patient_age: parsedAge(draft.age) });
        return { kind: "drill" as const, preview };
      }
      const created = await emergencies.create(
        {
          injury_type: draft.injuryType!,
          symptoms,
          location,
          consent: { accepted: draft.consent, policy_version: CONSENT_POLICY_VERSION },
          patient_age: parsedAge(draft.age),
          patient_sex: draft.sex,
          description: draft.description.trim(),
          blood_group: draft.bloodGroup || null,
          allergies: draft.allergies.trim() || null,
          sensitive: draft.sensitive,
          share_passport: draft.sharePassport,
        },
        draft.idempotencyKey,
      );
      return { kind: "real" as const, created };
    },
    onSuccess: (result) => {
      clear();
      if (result.kind === "drill") {
        navigate("/drill/result", { replace: true, state: { preview: result.preview, location: draft.location } });
      } else {
        void client.invalidateQueries({ queryKey: ["emergencies"] });
        client.setQueryData(["emergency", result.created.id], result.created);
        navigate(`/requests/${result.created.id}`, { replace: true });
      }
    },
  });

  function next() {
    if (draft.step === 1) {
      if (!draft.injuryType) return setShowErrors(true);
      return goTo(2);
    }
    if (draft.step === 2) return goTo(3);
    if (!draft.location || (!drill && !draft.consent) || !draft.injuryType) return setShowErrors(true);
    submit.mutate();
  }

  function back() {
    if (draft.step > 1) return goTo((draft.step - 1) as ReportDraft["step"]);
    setLeaveOpen(true);
  }

  const redYes = RED_FLAG_FIELDS.filter((f) => draft.answers[f] === "yes");
  const answered = SYMPTOM_FIELDS.filter((f) => draft.answers[f] !== null).length;
  const nextLabel =
    draft.step === 1 ? t("report.nextSymptoms") : draft.step === 2 ? t("report.nextLocation") : drill ? t("report.sendDrill") : t("report.send");

  const footer = (
    <div className="flex flex-col gap-2">
      {draft.step === 2 && (
        <>
          <div className="flex justify-between gap-2 text-xs text-slate-600">
            <span>{t("report.answered", { count: answered, total: SYMPTOM_FIELDS.length })}</span>
            {savedAt && <span>{t("report.draftSaved", { time: formatTime(savedAt.toISOString()) })}</span>}
          </div>
          <p className="text-xs text-slate-600">{t("report.unknownNote")}</p>
        </>
      )}
      {submit.error && <InlineError>{errorMessage(submit.error)}</InlineError>}
      <Button size="lg" onClick={next} loading={submit.isPending}>
        {submit.isPending ? t("report.sending") : nextLabel}
        {!submit.isPending && draft.step < 3 && <ChevronRight className="h-5 w-5" aria-hidden />}
      </Button>
    </div>
  );

  return (
    <CitizenLayout
      header={<BackHeader onBack={back} title={t("report.title")} subtitle={`${t("report.stepOf", { step: draft.step })}: ${t(`report.stepName_${draft.step}`)}`} />}
      footer={footer}
    >
      <div
        role="progressbar"
        aria-label={t("report.stepOf", { step: draft.step })}
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={draft.step}
        className="-mt-2 grid grid-cols-3 gap-1"
      >
        {[1, 2, 3].map((n) => (
          <span key={n} className={cx("h-1 rounded-full", n <= draft.step ? "bg-primary-700" : "bg-slate-200")} />
        ))}
      </div>

      {redYes.length > 0 && draft.redDismissed && (
        <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-900">
          {t("redFlag.banner")}
        </p>
      )}

      {draft.step === 1 && <InjuryStep draft={draft} update={update} showError={showErrors} />}
      {draft.step === 2 && <SymptomsStep draft={draft} update={update} />}
      {draft.step === 3 && <LocationStep draft={draft} update={update} showErrors={showErrors} />}

      {redYes.length > 0 && !draft.redDismissed && (
        <RedFlagScreen
          fields={redYes}
          onContinue={() => update({ redDismissed: true })}
          onUndo={() =>
            update({
              answers: draft.lastRed ? { ...draft.answers, [draft.lastRed]: null } : draft.answers,
              lastRed: null,
              redDismissed: false,
            })
          }
        />
      )}

      <Modal
        open={leaveOpen}
        title={t("report.leaveTitle")}
        onClose={() => setLeaveOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLeaveOpen(false)} data-autofocus>
              {t("report.leaveStay")}
            </Button>
            <Button variant="dark" onClick={() => navigate("/")}>
              {t("report.leaveConfirm")}
            </Button>
          </>
        }
      >
        {t("report.leaveBody")}
      </Modal>
    </CitizenLayout>
  );
}
