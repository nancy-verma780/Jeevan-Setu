import type { TFunction } from "i18next";
import type { TimelineItem } from "@/components/ui/Timeline";
import type { EmergencyDetail, Priority, RequestEvent } from "@/lib/api/types";
import { formatKm, formatTime } from "@/lib/format";

const str = (value: unknown) => (typeof value === "string" ? value : "");

export function timelineItems(events: RequestEvent[], t: TFunction): TimelineItem[] {
  return [...events].reverse().map((event) => {
    const name = str(event.data.hospital_name);
    const base = { id: event.id, time: formatTime(event.created_at, true) };
    switch (event.type) {
      case "PRIORITY_SET": {
        const priority = str(event.data.priority) as Priority;
        return { ...base, title: t("events.PRIORITY_SET", { label: t(`priority.${priority}`) }), tone: priority === "RED_FLAG" ? "danger" : "default" };
      }
      case "SENT_TO_HOSPITAL":
        return { ...base, title: t("events.SENT_TO_HOSPITAL", { name }), detail: t("events.SENT_TO_HOSPITAL_detail", { km: formatKm(Number(event.data.distance_km ?? 0)) }) };
      case "HOSPITAL_DECLINED": {
        const reason = str(event.data.reason);
        return { ...base, title: t("events.HOSPITAL_DECLINED", { name }), detail: reason ? t(`declineReason.${reason}`) : undefined };
      }
      case "HOSPITAL_ACCEPTED":
        return { ...base, title: t("events.HOSPITAL_ACCEPTED", { name }), tone: "success" };
      case "PATIENT_ARRIVED":
        return { ...base, title: t("events.PATIENT_ARRIVED", { name }), tone: "success" };
      case "NO_SUITABLE_HOSPITAL":
        return { ...base, title: t("events.NO_SUITABLE_HOSPITAL"), tone: "danger" };
      default:
        return { ...base, title: t(`events.${event.type}`, { name }) };
    }
  });
}

/** The hospital that last declined or timed out, if the request has since moved on. */
export function reassignment(detail: EmergencyDetail): { from: string; to: string } | null {
  if (detail.status !== "AWAITING_HOSPITAL_RESPONSE" || !detail.current_hospital) return null;
  const last = [...detail.events].reverse().find((e) => e.type === "HOSPITAL_DECLINED" || e.type === "HOSPITAL_TIMED_OUT");
  if (!last) return null;
  return { from: str(last.data.hospital_name), to: detail.current_hospital.name };
}
