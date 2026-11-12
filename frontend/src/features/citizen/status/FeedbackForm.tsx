import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { InlineError, useErrorMessage } from "@/components/ui/States";
import { emergencies } from "@/lib/api/endpoints";
import type { Feedback, FeedbackAnswer } from "@/lib/api/types";

export function FeedbackForm({ requestId, existing }: { requestId: number; existing: Feedback | null | undefined }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const errorMessage = useErrorMessage();
  const [ready, setReady] = useState<FeedbackAnswer | null>(null);
  const [correct, setCorrect] = useState<FeedbackAnswer | null>(null);
  const [comment, setComment] = useState("");
  const send = useMutation({
    mutationFn: () => emergencies.feedback(requestId, { hospital_ready: ready!, info_correct: correct!, comment }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["emergency", requestId] }),
  });

  if (existing || send.isSuccess) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg border border-success-200 bg-success-50 p-4 text-sm text-success-900">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t("feedback.thanks")}
      </p>
    );
  }
  const options = [
    { value: "yes" as const, label: t("common.yes") },
    { value: "no" as const, label: t("common.no") },
    { value: "unsure" as const, label: t("feedback.unsure"), neutral: true },
  ];
  return (
    <section aria-labelledby="fb-title" className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <h2 id="fb-title" className="font-bold">
        {t("feedback.title")}
      </h2>
      <p id="fb-ready" className="text-sm font-medium">
        {t("feedback.ready")}
      </p>
      <SegmentedControl value={ready} options={options} onChange={setReady} labelledBy="fb-ready" size="sm" />
      <p id="fb-correct" className="text-sm font-medium">
        {t("feedback.correct")}
      </p>
      <SegmentedControl value={correct} options={options} onChange={setCorrect} labelledBy="fb-correct" size="sm" />
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("feedback.comment")} <span className="font-normal text-slate-600">({t("common.optional")})</span>
        <Textarea value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} />
      </label>
      {send.isError && <InlineError>{errorMessage(send.error)}</InlineError>}
      <Button disabled={!ready || !correct} loading={send.isPending} onClick={() => send.mutate()}>
        {t("feedback.send")}
      </Button>
    </section>
  );
}
