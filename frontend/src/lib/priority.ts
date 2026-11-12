import { AlertCircle, AlertTriangle, Circle, HelpCircle, type LucideIcon } from "lucide-react";
import type { Priority } from "./api/types";

/** Priority is never shown by colour alone: every badge carries an icon and a word. */
export const PRIORITY_META: Record<Priority, { icon: LucideIcon; badge: string; panel: string; order: number }> = {
  RED_FLAG: {
    icon: AlertTriangle,
    badge: "bg-danger-50 text-danger-800 border-danger-200",
    panel: "bg-danger-50 border-danger-200 text-danger-900",
    order: 0,
  },
  NEEDS_REVIEW: {
    icon: HelpCircle,
    badge: "bg-info-50 text-info-800 border-info-200",
    panel: "bg-info-50 border-info-200 text-info-900",
    order: 1,
  },
  ELEVATED: {
    icon: AlertCircle,
    badge: "bg-warning-50 text-warning-800 border-warning-200",
    panel: "bg-warning-50 border-warning-200 text-warning-900",
    order: 2,
  },
  STANDARD: {
    icon: Circle,
    badge: "bg-slate-50 text-slate-700 border-slate-300",
    panel: "bg-slate-50 border-slate-300 text-slate-800",
    order: 3,
  },
};
