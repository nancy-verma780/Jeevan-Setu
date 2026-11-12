import { WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOnline } from "@/lib/hooks/useOnline";

export function OfflineBanner() {
  const { t } = useTranslation();
  if (useOnline()) return null;
  return (
    <div role="status" className="flex items-start gap-2 border-b border-warning-200 bg-warning-50 px-4 py-2 text-sm text-warning-900">
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{t("offline.banner")}</span>
    </div>
  );
}
