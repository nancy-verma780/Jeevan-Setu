import { useMutation } from "@tanstack/react-query";
import { Copy, Share2, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { InlineError, useErrorMessage } from "@/components/ui/States";
import { emergencies } from "@/lib/api/endpoints";
import { formatDateTime } from "@/lib/format";

/** View-only link for family members. It expires on its own. */
export function ShareButton({ requestId, code }: { requestId: number; code: string }) {
  const { t, i18n } = useTranslation();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const share = useMutation({ mutationFn: () => emergencies.share(requestId) });
  const url = share.data ? `${window.location.origin}${share.data.path}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        icon={Users}
        onClick={() => {
          setOpen(true);
          setCopied(false);
          if (!share.data) share.mutate();
        }}
      >
        {t("share.button")}
      </Button>
      <Modal open={open} title={t("share.title")} onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-3">
          <p>{t("share.body")}</p>
          {share.isPending && <p className="text-sm text-slate-600">{t("common.loading")}</p>}
          {share.isError && <InlineError>{errorMessage(share.error)}</InlineError>}
          {share.data && (
            <>
              <input readOnly value={url} aria-label={t("share.title")} onFocus={(e) => e.target.select()} className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
              <p className="text-xs text-slate-600">{t("share.expires", { time: formatDateTime(share.data.expires_at, i18n.language, t("common.today")) })}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" icon={Copy} onClick={() => void copy()}>
                  {copied ? t("share.copied") : t("share.copy")}
                </Button>
                {"share" in navigator ? (
                  <Button icon={Share2} onClick={() => void navigator.share({ title: "JeevanSetu", text: t("share.shareText", { code }), url }).catch(() => undefined)}>
                    {t("share.shareVia")}
                  </Button>
                ) : (
                  <Button onClick={() => setOpen(false)}>{t("common.close")}</Button>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
