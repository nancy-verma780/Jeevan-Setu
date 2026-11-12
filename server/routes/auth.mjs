import { config } from "../lib/config.mjs";
import { HttpError, invalid } from "../lib/http.mjs";
import { audit } from "../lib/allocation.mjs";
import { currentSession } from "../lib/router.mjs";
import { hashOtp, hashToken, newOtp, newToken, normaliseIndianMobile, sameHash, verifyPassword } from "../lib/security.mjs";

export function meOut(store, user) {
  const hospital = user.hospital_id ? store.get("hospitals", user.hospital_id) : null;
  return { id: user.id, role: user.role, name: user.name, phone: user.phone, email: user.email, hospital_id: user.hospital_id, hospital_name: hospital?.name ?? null };
}

function phoneFrom(body) {
  const phone = normaliseIndianMobile(body?.phone);
  if (!phone) throw invalid("Enter a 10-digit Indian mobile number.");
  return phone;
}

function openSession(store, user) {
  const token = newToken();
  const now = Date.now();
  store.insert("sessions", {
    user_id: user.id,
    token_hash: hashToken(token),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + config.sessionTtlHours * 3600_000).toISOString(),
    revoked_at: null,
  });
  audit(store, user.id, "LOGIN", "user", user.id);
  const cookie = [`${config.cookieName}=${token}`, "HttpOnly", "SameSite=Strict", "Path=/", `Max-Age=${config.sessionTtlHours * 3600}`];
  if (config.cookieSecure) cookie.push("Secure");
  return { "Set-Cookie": cookie.join("; ") };
}

export function registerAuth(router, store) {
  router.post("/api/auth/otp/request", async (ctx) => {
    const phone = phoneFrom(await ctx.json());
    const now = Date.now();
    const recent = store.filter("otp", (o) => o.phone === phone && now - Date.parse(o.created_at) < config.otpWindowSeconds * 1000).length;
    if (recent >= config.otpMaxRequestsPerWindow) throw new HttpError(429, "Too many codes requested. Wait 10 minutes and try again.");
    const code = newOtp();
    store.insert("otp", {
      phone,
      code_hash: hashOtp(phone, code, config.otpPepper),
      attempts: 0,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + config.otpTtlSeconds * 1000).toISOString(),
      consumed_at: null,
    });
    // SMS delivery is out of scope for the prototype; development builds return the code.
    return { body: { expires_in_seconds: config.otpTtlSeconds, dev_code: config.exposeDevOtp ? code : null } };
  });

  router.post("/api/auth/otp/verify", async (ctx) => {
    const body = await ctx.json();
    const phone = phoneFrom(body);
    if (!/^\d{6}$/.test(String(body.code ?? ""))) throw invalid("Enter the 6-digit code.");
    const now = Date.now();
    const challenge = store.filter("otp", (o) => o.phone === phone && !o.consumed_at && Date.parse(o.expires_at) > now).at(-1);
    if (!challenge) throw invalid("This code has expired. Ask for a new one.");
    if (challenge.attempts >= config.otpMaxAttempts) throw new HttpError(429, "Too many wrong codes. Ask for a new one.");
    if (!sameHash(challenge.code_hash, hashOtp(phone, body.code, config.otpPepper))) {
      challenge.attempts += 1;
      throw invalid("That code is not right. Check the SMS and try again.");
    }
    challenge.consumed_at = new Date(now).toISOString();
    let user = store.find("users", (u) => u.phone === phone);
    if (!user) {
      user = store.insert("users", { role: "citizen", name: "", phone, email: null, password_hash: null, hospital_id: null, is_active: true, created_at: new Date(now).toISOString() });
    } else if (user.role !== "citizen" || !user.is_active) {
      throw invalid("This number cannot sign in here.");
    }
    return { body: meOut(store, user), headers: openSession(store, user) };
  });

  router.post("/api/auth/login", async (ctx) => {
    const body = await ctx.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const user = store.find("users", (u) => u.email === email);
    const ok = verifyPassword(user?.password_hash, String(body.password ?? ""));
    if (!ok || !user || !user.is_active || user.role === "citizen") throw invalid("Email or password is wrong.");
    return { body: meOut(store, user), headers: openSession(store, user) };
  });

  router.post("/api/auth/logout", (ctx) => {
    const { session } = currentSession(store, ctx.req);
    session.revoked_at = new Date().toISOString();
    audit(store, session.user_id, "LOGOUT", "user", session.user_id);
    return { status: 204, headers: { "Set-Cookie": `${config.cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` } };
  });

  router.get("/api/auth/me", (ctx) => ({ body: meOut(store, ctx.user()) }));
}
