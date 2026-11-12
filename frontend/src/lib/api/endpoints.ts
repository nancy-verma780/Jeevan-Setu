import { api } from "./client";
import type {
  AccessLogRow,
  Broadcast,
  Note,
  ReadinessItem,
  CaseReport,
  Feedback,
  HospitalStat,
  Insights,
  OutboxRow,
  Passport,
  TrackView,
  WhatIfResult,
  AdminOverview,
  AdminRequestRow,
  AuditRow,
  DeclineReason,
  DrillPreview,
  EmergencyCreate,
  EmergencyDetail,
  EmergencySummary,
  Hospital,
  HospitalPin,
  ImageInfo,
  Me,
  ModelInfo,
  Service,
  StaffAccount,
  StaffCaseDetail,
  StaffQueueRow,
} from "./types";

export const auth = {
  me: () => api<Me>("/api/auth/me"),
  requestOtp: (phone: string) =>
    api<{ expires_in_seconds: number; dev_code: string | null }>("/api/auth/otp/request", { body: { phone } }),
  verifyOtp: (phone: string, code: string) => api<Me>("/api/auth/otp/verify", { body: { phone, code } }),
  login: (email: string, password: string) => api<Me>("/api/auth/login", { body: { email, password } }),
  logout: () => api<void>("/api/auth/logout", { method: "POST" }),
};

export const emergencies = {
  list: () => api<EmergencySummary[]>("/api/emergencies"),
  get: (id: number) => api<EmergencyDetail>(`/api/emergencies/${id}`),
  create: (payload: EmergencyCreate, idempotencyKey: string) =>
    api<EmergencyDetail>("/api/emergencies", {
      body: payload as unknown as Record<string, unknown>,
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  cancel: (id: number) => api<EmergencyDetail>(`/api/emergencies/${id}/cancel`, { method: "POST" }),
  share: (id: number) => api<{ path: string; expires_at: string }>(`/api/emergencies/${id}/share`, { method: "POST" }),
  accessLog: (id: number) => api<AccessLogRow[]>(`/api/emergencies/${id}/access-log`),
  feedback: (id: number, body: Pick<Feedback, "hospital_ready" | "info_correct" | "comment">) =>
    api<Feedback>(`/api/emergencies/${id}/feedback`, { body: body as unknown as Record<string, unknown> }),
  uploadPhoto: (id: number, file: File) => {
    const form = new FormData();
    form.append("photo", file);
    return api<ImageInfo>(`/api/emergencies/${id}/images`, { body: form });
  },
};

export const hospitals = {
  pins: () => api<HospitalPin[]>("/api/hospitals"),
};

export const passport = {
  get: () => api<Passport | null>("/api/me/passport"),
  save: (body: Passport) => api<Passport>("/api/me/passport", { method: "PUT", body: body as unknown as Record<string, unknown> }),
};

export const publicApi = {
  broadcast: () => api<Broadcast>("/api/broadcast"),
  setSurge: (body: { active: boolean; message: string; radius_km: number }) => api<Broadcast>("/api/admin/surge", { method: "PUT", body }),
  track: (token: string) => api<TrackView>(`/api/track/${encodeURIComponent(token)}`),
  scorecard: () => api<{ hospitals: HospitalStat[]; updated_at: string }>("/api/public/scorecard"),
};

export const model = {
  info: () => api<ModelInfo>("/api/model"),
};

export const drill = {
  preview: (payload: Pick<EmergencyCreate, "injury_type" | "symptoms" | "location" | "patient_age">) =>
    api<DrillPreview>("/api/drill/preview", { body: payload as unknown as Record<string, unknown> }),
};

export type QueueTab = "pending" | "accepted" | "declined";

export const staff = {
  queue: (tab: QueueTab) => api<StaffQueueRow[]>(`/api/staff/requests?status=${tab}`),
  detail: (assignmentId: number) => api<StaffCaseDetail>(`/api/staff/requests/${assignmentId}`),
  images: (assignmentId: number) => api<ImageInfo[]>(`/api/staff/requests/${assignmentId}/images`),
  decide: (assignmentId: number, action: "accept" | "decline", reason?: DeclineReason) =>
    api<StaffCaseDetail>(`/api/staff/requests/${assignmentId}/decision`, { body: { action, reason } }),
  arrived: (assignmentId: number) => api<StaffCaseDetail>(`/api/staff/requests/${assignmentId}/arrived`, { method: "POST" }),
  hospital: () => api<Hospital>("/api/staff/hospital"),
  readiness: (item: ReadinessItem, available: boolean) => api<Hospital>("/api/staff/readiness", { method: "PUT", body: { item, available } }),
  comments: (assignmentId: number) => api<Note[]>(`/api/staff/requests/${assignmentId}/comments`),
  addComment: (assignmentId: number, text: string) => api<Note>(`/api/staff/requests/${assignmentId}/comments`, { body: { text } }),
  handover: () => api<Note[]>("/api/staff/handover"),
  addHandover: (text: string) => api<Note>("/api/staff/handover", { body: { text } }),
  updateHospital: (changes: Partial<{ free_beds: number; services: Service[]; diversion: boolean }>) =>
    api<Hospital>("/api/staff/hospital", { method: "PATCH", body: changes }),
  imageUrl: (imageId: number, variant: "photo" | "heatmap") => `/api/staff/images/${imageId}?variant=${variant}`,
};

export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const admin = {
  overview: () => api<AdminOverview>("/api/admin/overview"),
  requests: (q: string) => api<AdminRequestRow[]>(`/api/admin/requests${q}`),
  hospitals: () => api<Hospital[]>("/api/admin/hospitals"),
  updateHospital: (id: number, changes: Partial<Pick<Hospital, "open_for_emergency" | "diversion">>) =>
    api<Hospital>(`/api/admin/hospitals/${id}`, { method: "PATCH", body: changes }),
  staff: (q: string) => api<StaffAccount[]>(`/api/admin/staff${q}`),
  createStaff: (body: { name: string; email: string; password: string; hospital_id: number }) =>
    api<StaffAccount>("/api/admin/staff", { body }),
  updateStaff: (id: number, changes: { is_active?: boolean }) =>
    api<StaffAccount>(`/api/admin/staff/${id}`, { method: "PATCH", body: changes }),
  audit: (q: string) => api<AuditRow[]>(`/api/admin/audit${q}`),
  insights: () => api<Insights>("/api/admin/insights"),
  whatIf: (body: { wd: number; wr: number; dmax: number; bcap: number }) => api<WhatIfResult>("/api/admin/whatif", { body }),
  notifications: () => api<OutboxRow[]>("/api/admin/notifications"),
  caseReport: (id: number) => api<CaseReport>(`/api/admin/requests/${id}`),
  csvUrl: (table: "requests" | "hospitals" | "staff" | "audit" | "notifications", q: string) =>
    `/api/admin/${table}${q ? `${q}&` : "?"}format=csv`,
};
