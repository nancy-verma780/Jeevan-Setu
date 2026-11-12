import { useMutation } from "@tanstack/react-query";
import { Camera, CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { InlineError } from "@/components/ui/States";
import { ApiError } from "@/lib/api/client";
import { emergencies } from "@/lib/api/endpoints";

const KNOWN_CODES = ["retake_too_dark", "retake_too_bright", "retake_blurred", "corrupt", "unsupported_type", "too_large", "too_many_pixels"];

/** Optional and separate from the report, so a slow upload never delays the request. */
export function PhotoUpload({ requestId }: { requestId: number }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [sent, setSent] = useState(0);
  const upload = useMutation({
    mutationFn: (file: File) => emergencies.uploadPhoto(requestId, file),
    onSuccess: () => setSent((n) => n + 1),
  });

  function message(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.code && KNOWN_CODES.includes(error.code)) return t(`photo.${error.code}`);
      if (error.status === 409) return t("photo.limit");
      if (error.message) return error.message;
    }
    return t("errors.generic");
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.mutate(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={upload.isPending || sent >= 3}
        className="flex min-h-[56px] items-center gap-3 rounded-lg border border-dashed border-slate-400 bg-white px-4 text-left disabled:opacity-60"
      >
        <Camera className="h-5 w-5 shrink-0 text-primary-700" aria-hidden />
        <span className="flex flex-col">
          <span className="font-semibold">{upload.isPending ? t("photo.uploading") : sent ? t("photo.another") : t("photo.title")}</span>
          <span className="text-xs text-slate-600">{t("photo.sub")}</span>
        </span>
      </button>
      {upload.isError && <InlineError>{message(upload.error)}</InlineError>}
      {sent > 0 && !upload.isError && (
        <p role="status" className="flex items-start gap-2 text-sm text-success-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t("photo.done")}
        </p>
      )}
    </div>
  );
}
