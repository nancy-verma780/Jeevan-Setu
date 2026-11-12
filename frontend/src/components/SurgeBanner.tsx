import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { publicApi } from "@/lib/api/endpoints";

/** Surge / Disaster Mode broadcast from the administrator. */
export function SurgeBanner() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ["broadcast"], queryFn: publicApi.broadcast, refetchInterval: 60_000, retry: false });
  if (!query.data?.active) return null;
  return (
    <div role="alert" className="border-b border-warning-300 bg-warning-100 px-4 py-2 text-sm text-warning-900">
      <p className="mx-auto flex max-w-5xl items-start gap-2">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          <b>{t("surge.banner")}</b> {query.data.message} {t("surge.radius", { km: query.data.radius_km })}
        </span>
      </p>
    </div>
  );
}
