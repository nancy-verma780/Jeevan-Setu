import { AlertTriangle } from "lucide-react";
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Call112Button } from "@/components/Call112Button";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
import type { SymptomField } from "@/lib/api/types";

/** Takes over the whole screen. Nothing on it competes with the call button. */
export function RedFlagScreen({ fields, onContinue, onUndo }: { fields: SymptomField[]; onContinue: () => void; onUndo: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(ref, true, onContinue);
  return createPortal(
    <div
      ref={ref}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex flex-col bg-danger-700 px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-12 text-white"
    >
      <div className="mx-auto flex w-full max-w-citizen flex-1 flex-col gap-6">
        <div className="flex flex-1 flex-col gap-4">
          <AlertTriangle className="h-12 w-12" aria-hidden />
          <h2 id={titleId} className="text-2xl font-bold">
            {t("redFlag.title")}
          </h2>
          <p className="text-lg">{t("redFlag.body")}</p>
          <p className="text-base text-danger-100">{t("redFlag.because", { list: fields.map((f) => t(`symptomShort.${f}`)).join(", ") })}</p>
        </div>
        <Call112Button variant="hero" label={t("redFlag.call")} className="w-full" />
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onContinue} className="min-h-tap rounded-lg border border-white px-4 font-semibold">
            {t("redFlag.continue")}
          </button>
          <button type="button" onClick={onUndo} className="min-h-tap px-4 text-sm underline">
            {t("redFlag.undo")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
