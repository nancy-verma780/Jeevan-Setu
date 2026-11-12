export type Role = "citizen" | "staff" | "admin";
export type Priority = "RED_FLAG" | "NEEDS_REVIEW" | "ELEVATED" | "STANDARD";
export type RequestStatus =
  | "SUBMITTED"
  | "FINDING_HOSPITAL"
  | "AWAITING_HOSPITAL_RESPONSE"
  | "HOSPITAL_ACCEPTED"
  | "PATIENT_ARRIVED"
  | "NO_SUITABLE_HOSPITAL"
  | "CANCELLED";
export type AssignmentStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "TIMED_OUT" | "CANCELLED";
export type InjuryType = "road_accident" | "burn" | "fall_fracture" | "cardiac" | "breathing" | "cut" | "other";
export type Service = "general_emergency" | "trauma_care" | "burn_care" | "orthopaedics" | "cardiac_care";
export type Answer = "yes" | "no" | "unknown";
export type LocationSource = "gps" | "map_pin" | "manual";
export type Sex = "female" | "male" | "other" | "unknown";
export type DeclineReason = "no_bed" | "specialist_unavailable" | "equipment_unavailable" | "other";
export type EventType =
  | "SUBMITTED"
  | "PRIORITY_SET"
  | "SENT_TO_HOSPITAL"
  | "HOSPITAL_ACCEPTED"
  | "HOSPITAL_DECLINED"
  | "HOSPITAL_TIMED_OUT"
  | "NO_SUITABLE_HOSPITAL"
  | "PATIENT_ARRIVED"
  | "CANCELLED";

export interface Freshness {
  level: "fresh" | "ageing" | "stale" | "missing";
  age_minutes: number | null;
  confidence: number;
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface Passport {
  blood_group: string | null;
  allergies: string | null;
  conditions: string | null;
  contacts: EmergencyContact[];
  updated_at?: string;
}

export type FeedbackAnswer = "yes" | "no" | "unsure";
export interface Feedback {
  hospital_ready: FeedbackAnswer;
  info_correct: FeedbackAnswer;
  comment: string;
  created_at: string;
}

export interface AccessLogRow {
  id: number;
  action: string;
  created_at: string;
  staff_name: string;
  hospital_name: string;
}

export interface TrackView {
  public_code: string;
  status: RequestStatus;
  created_at: string;
  expires_at: string;
  hospital: { name: string; accepted: boolean; address: string | null } | null;
  events: Array<{ id: number; type: EventType; created_at: string; hospital_name: string | null }>;
}

export const SYMPTOM_FIELDS = [
  "unresponsive",
  "breathing_difficulty",
  "heavy_bleeding",
  "chest_pain",
  "seizure_now",
  "minor_bleeding",
  "severe_pain",
  "suspected_fracture",
] as const;
export type SymptomField = (typeof SYMPTOM_FIELDS)[number];
export const RED_FLAG_FIELDS: readonly SymptomField[] = [
  "unresponsive",
  "breathing_difficulty",
  "heavy_bleeding",
  "chest_pain",
  "seizure_now",
];
export type Symptoms = Record<SymptomField, Answer>;

export interface Me {
  id: number;
  role: Role;
  name: string;
  phone: string | null;
  email: string | null;
  hospital_id: number | null;
  hospital_name: string | null;
}

export interface Reason {
  rule: string;
  text: string;
  field: string | null;
}

export interface RankingTerms {
  distance_km: number;
  distance_term: number;
  resource_term: number;
  reliability: number;
  reliability_term: number;
  score: number;
  availability_flag: "missing" | "stale" | null;
}

export interface CurrentHospital {
  assignment_id: number;
  status: AssignmentStatus;
  hospital_id: number;
  name: string;
  services: Service[];
  free_beds: number | null;
  beds_updated_at?: string | null;
  freshness?: Freshness;
  is_simulated: boolean;
  deadline_at: string;
  seconds_left: number;
  terms: RankingTerms;
  address: string | null;
  phone: string | null;
}

export interface RequestEvent {
  id: number;
  type: EventType;
  data: Record<string, unknown>;
  created_at: string;
}

export interface EmergencyDetail {
  id: number;
  public_code: string;
  injury_type: InjuryType;
  priority: Priority;
  priority_reasons: Reason[];
  rule_set_version: string;
  status: RequestStatus;
  created_at: string;
  lat: number;
  lng: number;
  location_source: LocationSource;
  sensitive?: boolean;
  passport_shared?: boolean;
  feedback?: Feedback | null;
  current_hospital: CurrentHospital | null;
  events: RequestEvent[];
}

export interface EmergencySummary {
  id: number;
  public_code: string;
  injury_type: InjuryType;
  priority: Priority;
  status: RequestStatus;
  created_at: string;
  hospital_name: string | null;
}

export interface EmergencyCreate {
  injury_type: InjuryType;
  symptoms: Symptoms;
  location: { lat: number; lng: number; source: LocationSource };
  consent: { accepted: boolean; policy_version: string };
  patient_age: number | null;
  patient_sex: Sex;
  description: string;
  blood_group: string | null;
  allergies: string | null;
  sensitive?: boolean;
  share_passport?: boolean;
}

export interface HospitalPin {
  id: number;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  services: Service[];
  is_simulated: boolean;
  diversion: boolean;
}

export interface Hospital extends HospitalPin {
  free_beds: number | null;
  beds_updated_at: string | null;
  open_for_emergency: boolean;
  freshness?: Freshness;
}

export interface ModelMetrics {
  test_accuracy?: number;
  test_macro_f1?: number;
  coverage?: number;
  selective_accuracy?: number;
  tau?: number;
  cpu_ms_per_image?: number;
  images?: { train: number; validation: number; test: number };
}

export interface ModelInfo {
  loaded: boolean;
  message: string | null;
  name: string | null;
  classes: string[] | null;
  tau: number | null;
  metrics: ModelMetrics | null;
  trained_at: string | null;
}

export interface Analysis {
  analyzer: string | null;
  version: string | null;
  prediction: string | null;
  confidence: number | null;
  abstained: boolean | null;
  has_heatmap: boolean;
  notice: string;
}

export interface ImageInfo {
  id: number;
  created_at: string;
  width: number;
  height: number;
  size_bytes: number;
  analysis: Analysis;
}

export interface StaffQueueRow {
  assignment_id: number;
  request_code: string;
  priority: Priority;
  injury_type: InjuryType;
  patient_age: number | null;
  patient_sex: Sex;
  distance_km: number;
  status: AssignmentStatus;
  received_at: string;
  deadline_at: string;
  seconds_left: number;
  arrived_at?: string | null;
  sensitive?: boolean;
}

export interface PreArrivalPacket {
  request_code: string;
  priority: Priority;
  patient_age: number | null;
  patient_sex: Sex;
  injury_type: InjuryType;
  blood_group: string | null;
  allergies: string | null;
  conditions?: string | null;
  emergency_contacts?: EmergencyContact[];
  passport_shared?: boolean;
  description: string;
  contact_name: string | null;
  contact_phone: string | null;
  lat: number;
  lng: number;
  location_source: LocationSource;
}

export interface StaffCaseDetail extends StaffQueueRow {
  priority_reasons: Reason[];
  rule_set_version: string;
  symptoms: Partial<Symptoms>;
  packet: PreArrivalPacket;
  decline_reason: DeclineReason | null;
}

export interface DrillCandidate {
  hospital_id: number;
  name: string;
  distance_km: number;
  distance_term: number;
  resource_term: number;
  reliability_term: number;
  score: number;
  availability_flag: "missing" | "stale" | null;
}

export interface DrillPreview {
  priority: Priority;
  priority_reasons: Reason[];
  rule_set_version: string;
  candidates: DrillCandidate[];
}

export interface AdminOverview {
  total_requests: number;
  by_status: Record<RequestStatus, number>;
  median_response_seconds: number | null;
  accept_rate: number | null;
  no_hospital_cases: number;
  per_hospital?: HospitalStat[];
}

export interface HospitalStat {
  hospital_id?: number;
  name: string;
  asked: number;
  accepted: number;
  declined: number;
  timed_out: number;
  accept_rate: number | null;
  median_reply_seconds: number | null;
}

export interface Insights {
  refusals_by_reason: Array<{ reason: DeclineReason; count: number }>;
  by_hospital: HospitalStat[];
  by_area: Array<{ area: string; requests: number; declined: number; no_hospital: number }>;
  by_hour: Array<{ hour: number; requests: number; accept_rate: number | null; median_reply_seconds: number | null }>;
  feedback: { count: number; hospital_ready_yes: number | null; info_correct_yes: number | null };
}

export interface WhatIfResult {
  requests: number;
  changed: number;
  no_hospital_before: number;
  no_hospital_after: number;
  avg_distance_before: number | null;
  avg_distance_after: number | null;
  examples: Array<{ code: string; injury_type: InjuryType; before: string | null; after: string | null }>;
}

export interface OutboxRow {
  id: number;
  created_at: string;
  channel: string;
  to: string;
  text: string;
  request_id: number;
  status: string;
}

export interface CaseReport {
  id: number;
  public_code: string;
  created_at: string;
  updated_at: string;
  injury_type: InjuryType;
  priority: Priority;
  priority_reasons: Reason[];
  rule_set_version: string;
  status: RequestStatus;
  sensitive: boolean;
  location_source: LocationSource;
  assignments: Array<{
    hospital: string;
    status: AssignmentStatus;
    created_at: string;
    decided_at: string | null;
    arrived_at: string | null;
    reason: DeclineReason | null;
    distance_km: number;
    distance_term: number;
    resource_term: number;
    reliability_term: number;
    score: number;
    availability_flag: string | null;
  }>;
  events: Array<{ id: number; type: EventType; created_at: string; hospital_name: string | null; reason: string | null }>;
  feedback: Feedback | null;
}

export interface AdminRequestRow {
  id: number;
  public_code: string;
  created_at: string;
  injury_type: InjuryType;
  priority: Priority;
  status: RequestStatus;
  hospitals_asked: number;
  current_hospital: string | null;
  lat: number;
  lng: number;
  sensitive?: boolean;
  reporter_trust?: number;
}

export interface StaffAccount {
  id: number;
  name: string;
  email: string;
  hospital_id: number | null;
  hospital_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuditRow {
  id: number;
  created_at: string;
  actor_user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: string;
}
