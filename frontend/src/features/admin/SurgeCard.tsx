import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { InlineError, useErrorMessage } from "@/components/ui/States";
import { publicApi } from "@/lib/api/endpoints";
import { FILTER_CONTROL } from "./TableShell";

/** Surge / Disaster Mode: broadcast to citizens and staff, and widen the search radius for a while. */
export function SurgeCard() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const errorMessage = useErrorMessage();
  const current = useQuery({ queryKey: ["broadcast"], queryFn: publicApi.broadcast });
  const [message, setMessage] = useState("");
  const [radius, setRadius] = useState(40);
  useEffect(() => {
    if (current.data?.active) {
      setMessage(current.data.message ?? "");
      setRadius(current.data.radius_km ?? 40);
    }
  }, [current.data]);
  const save = useMutation({
    mutationFn: (active: boolean) => publicApi.setSurge({ active, message, radius_km: radius }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["broadcast"] }),
  });
  const active = Boolean(current.data?.active);
  return (
    <section aria-labelledby="surge-title" className={`flex flex-col gap-3 rounded-lg border p-4 ${active ? "border-warning-300 bg-warning-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start gap-3">
        <Megaphone className="mt-0.5 h-5 w-5 text-warning-800" aria-hidden />
        <div className="flex-1">
          <h2 id="surge-title" className="font-bold">
            {t("surge.title")} {active && <span className="text-warning-800">({t("surge.on")})</span>}
          </h2>
          <p className="text-sm text-slate-700">{t("surge.note")}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-700">
          {t("surge.message")}
          <input value={message} maxLength={280} onChange={(e) => setMessage(e.target.value)} className={FILTER_CONTROL} placeholder={t("surge.placeholder")} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
          {t("surge.radiusLabel")}
          <input type="number" min={25} max={60} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className={`${FILTER_CONTROL} w-24`} />
        </label>
        {active ? (
          <>
            <Button size="sm" variant="secondary" loading={save.isPending} onClick={() => save.mutate(true)}>
              {t("surge.update")}
            </Button>
            <Button size="sm" loading={save.isPending} onClick={() => save.mutate(false)}>
              {t("surge.stop")}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="danger" loading={save.isPending} onClick={() => save.mutate(true)}>
            {t("surge.start")}
          </Button>
        )}
      </div>
      {save.isError && <InlineError>{errorMessage(save.error)}</InlineError>}
    </section>
  );
}
