import { newIdempotencyKey } from "@/lib/api/client";
import { SYMPTOM_FIELDS, type Answer, type InjuryType, type LocationSource, type Sex, type SymptomField, type Symptoms } from "@/lib/api/types";

export interface ReportDraft {
  step: 1 | 2 | 3;
  injuryType: InjuryType | null;
  /** null means not answered yet; it is sent as "unknown", never as "no". */
  answers: Record<SymptomField, Answer | null>;
  detailsOpen: boolean;
  age: string;
  sex: Sex;
  description: string;
  bloodGroup: string;
  allergies: string;
  location: { lat: number; lng: number; source: LocationSource } | null;
  consent: boolean;
  sensitive: boolean;
  sharePassport: boolean;
  redDismissed: boolean;
  lastRed: SymptomField | null;
  /** One key per report, so a retried or double-tapped send creates one request. */
  idempotencyKey: string;
}

export const DRAFT_KEY = "js_report_draft";

export function emptyDraft(): ReportDraft {
  return {
    step: 1,
    injuryType: null,
    answers: Object.fromEntries(SYMPTOM_FIELDS.map((f) => [f, null])) as Record<SymptomField, Answer | null>,
    detailsOpen: false,
    age: "",
    sex: "unknown",
    description: "",
    bloodGroup: "",
    allergies: "",
    location: null,
    consent: false,
    sensitive: false,
    sharePassport: false,
    redDismissed: false,
    lastRed: null,
    idempotencyKey: newIdempotencyKey(),
  };
}

export function toSymptoms(answers: ReportDraft["answers"]): Symptoms {
  return Object.fromEntries(SYMPTOM_FIELDS.map((f) => [f, answers[f] ?? "unknown"])) as Symptoms;
}

export function parsedAge(age: string): number | null {
  const n = Number.parseInt(age, 10);
  return Number.isFinite(n) && n >= 0 && n <= 120 ? n : null;
}

export type UpdateDraft = (patch: Partial<ReportDraft>) => void;
