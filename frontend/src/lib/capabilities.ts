import type { InjuryType, Service } from "./api/types";

/** Table II of the paper. A project assumption, not clinical routing guidance. */
export const REQUIRED_SERVICES: Record<InjuryType, Service[]> = {
  road_accident: ["general_emergency", "trauma_care"],
  burn: ["general_emergency", "burn_care"],
  fall_fracture: ["general_emergency", "orthopaedics"],
  cardiac: ["general_emergency", "cardiac_care"],
  breathing: ["general_emergency"],
  cut: ["general_emergency"],
  other: ["general_emergency"],
};

export const INJURY_TYPES: InjuryType[] = ["road_accident", "burn", "fall_fracture", "cardiac", "breathing", "cut", "other"];
