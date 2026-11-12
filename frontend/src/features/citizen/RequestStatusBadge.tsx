import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import type { RequestStatus } from "@/lib/api/types";

export function RequestStatusBadge({ status, hospital }: { status: RequestStatus; hospital?: string | null }) {
  const { t } = useTranslation();
  if (status === "PATIENT_ARRIVED") return <Badge tone="success" icon={CheckCircle2}>{t("requestStatus.PATIENT_ARRIVED")}</Badge>;
  if (status === "HOSPITAL_ACCEPTED") {
    return (
      <Badge tone="success" icon={CheckCircle2} className="whitespace-normal">
        {hospital ? `${t("requestStatus.HOSPITAL_ACCEPTED")}: ${hospital}` : t("requestStatus.HOSPITAL_ACCEPTED")}
      </Badge>
    );
  }
  if (status === "NO_SUITABLE_HOSPITAL") return <Badge tone="danger" icon={AlertTriangle}>{t("requestStatus.NO_SUITABLE_HOSPITAL")}</Badge>;
  if (status === "CANCELLED") return <Badge tone="neutral" icon={XCircle}>{t("requestStatus.CANCELLED")}</Badge>;
  return <Badge tone="warning" icon={Clock}>{t(`requestStatus.${status}`)}</Badge>;
}
