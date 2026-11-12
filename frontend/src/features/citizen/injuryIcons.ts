import { Bandage, Bone, Car, Flame, HeartPulse, HelpCircle, Wind, type LucideIcon } from "lucide-react";
import type { InjuryType } from "@/lib/api/types";

export const INJURY_ICONS: Record<InjuryType, LucideIcon> = {
  road_accident: Car,
  burn: Flame,
  fall_fracture: Bone,
  cardiac: HeartPulse,
  breathing: Wind,
  cut: Bandage,
  other: HelpCircle,
};
