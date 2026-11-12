/**
 * Preliminary priority from Table I of the paper. Rules run in a fixed order and
 * every rule that fires is stored with a plain-language reason. The image analyzer
 * has no input here by design.
 */
export const RULE_SET_VERSION = "1.0";

export const RED_FLAG_RULES = [
  ["unresponsive", "R1", "Not responding or unconscious"],
  ["breathing_difficulty", "R2", "Not breathing or severe difficulty breathing"],
  ["heavy_bleeding", "R3", "Heavy bleeding"],
  ["chest_pain", "R4", "Chest pain"],
  ["seizure_now", "R5", "Seizure in progress"],
];
export const CORE_FIELDS = RED_FLAG_RULES.map(([field]) => field);
export const CONCERN_SYMPTOMS = [
  ["minor_bleeding", "C1", "Some bleeding"],
  ["severe_pain", "C2", "Pain 7/10 or more"],
  ["suspected_fracture", "C5", "Suspected fracture"],
];
export const SYMPTOM_FIELDS = [...CORE_FIELDS, ...CONCERN_SYMPTOMS.map(([field]) => field)];

/** Anything other than an explicit yes or no counts as unknown, never as no. */
export function normaliseAnswer(value) {
  const v = typeof value === "string" ? value.toLowerCase() : "";
  return v === "yes" || v === "no" ? v : "unknown";
}

export function evaluatePriority(injuryType, symptoms, patientAge) {
  const answers = Object.fromEntries(SYMPTOM_FIELDS.map((f) => [f, normaliseAnswer(symptoms?.[f])]));
  const reason = (rule, text, field = null) => ({ rule, text, field });

  const red = RED_FLAG_RULES.filter(([f]) => answers[f] === "yes").map(([f, rule, label]) => reason(rule, `${label}: Yes`, f));
  if (red.length) return { category: "RED_FLAG", reasons: red, ruleSetVersion: RULE_SET_VERSION };

  const unknown = RED_FLAG_RULES.filter(([f]) => answers[f] === "unknown").map(([f, , label]) => reason("U1", `${label}: Unknown (core question)`, f));
  if (unknown.length) return { category: "NEEDS_REVIEW", reasons: unknown, ruleSetVersion: RULE_SET_VERSION };

  const concerns = CONCERN_SYMPTOMS.filter(([f]) => answers[f] === "yes").map(([f, rule, label]) => reason(rule, `${label}: Yes`, f));
  if (patientAge !== null && patientAge !== undefined && patientAge < 5) concerns.push(reason("C3", "Age under 5", "patient_age"));
  if (patientAge !== null && patientAge !== undefined && patientAge >= 65) concerns.push(reason("C3", "Age 65 or over", "patient_age"));
  if (injuryType === "burn") concerns.push(reason("C4", "Burn injury", "injury_type"));
  if (injuryType === "fall_fracture" && answers.suspected_fracture !== "yes") concerns.push(reason("C5", "Suspected fracture (injury type)", "injury_type"));
  if (concerns.length) return { category: "ELEVATED", reasons: concerns, ruleSetVersion: RULE_SET_VERSION };

  return { category: "STANDARD", reasons: [reason("S1", "All core questions answered, no danger or concern signs")], ruleSetVersion: RULE_SET_VERSION };
}
