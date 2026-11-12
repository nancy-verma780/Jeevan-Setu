import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

export const config = {
  // Hosting platforms such as Render and Railway pass the port in PORT.
  port: Number(env.JS_PORT || env.PORT || 8000),
  dataDir: path.resolve(env.JS_DATA_DIR ?? path.join(here, "..", "data")),
  distDir: path.resolve(here, "..", "..", "frontend", "dist"),
  exposeDevOtp: (env.JS_EXPOSE_DEV_OTP ?? "true") === "true",
  cookieSecure: env.JS_COOKIE_SECURE === "true",
  cookieName: "js_session",
  sessionTtlHours: 12,
  otpTtlSeconds: 300,
  otpMaxAttempts: 5,
  otpMaxRequestsPerWindow: Number(env.JS_OTP_MAX_REQUESTS ?? 10),
  otpWindowSeconds: 600,
  otpPepper: env.JS_OTP_PEPPER ?? "dev-only-pepper",
  consentPolicyVersion: "2026-10-01",
  replyTimeoutSeconds: Number(env.JS_REPLY_TIMEOUT_SECONDS ?? 120),
  reportsPerHour: Number(env.JS_REPORTS_PER_HOUR ?? 5),
  shareTtlHours: 24,
  shareAfterCloseHours: 2,
  timeoutPollMs: 5000,
  imageMaxBytes: 5 * 1024 * 1024,
  imageMaxPixels: 25_000_000,
  blurThreshold: 45,
  minBrightness: 40,
  maxBrightness: 220,
};
