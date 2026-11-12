import { HttpError, parseCookies } from "./http.mjs";
import { config } from "./config.mjs";
import { hashToken } from "./security.mjs";

export function createRouter() {
  const routes = [];
  const add = (method, pattern, handler, role = null) => {
    const keys = [];
    const regex = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)"))}$`);
    routes.push({ method, regex, keys, handler, role });
  };
  const match = (method, pathname) => {
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.regex.exec(pathname);
      if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  };
  return {
    get: (p, h, role) => add("GET", p, h, role),
    post: (p, h, role) => add("POST", p, h, role),
    put: (p, h, role) => add("PUT", p, h, role),
    patch: (p, h, role) => add("PATCH", p, h, role),
    match,
  };
}

export function currentSession(store, req) {
  const token = parseCookies(req.headers.cookie)[config.cookieName];
  if (!token) throw new HttpError(401, "Sign in to continue.");
  const hash = hashToken(token);
  const session = store.find("sessions", (s) => s.token_hash === hash && !s.revoked_at && Date.parse(s.expires_at) > Date.now());
  const user = session ? store.get("users", session.user_id) : null;
  if (!session || !user?.is_active) throw new HttpError(401, "Your session has ended. Sign in again.");
  return { session, user };
}

export function requireRole(user, role) {
  if (role && user.role !== role) throw new HttpError(403, "You do not have access to this page.");
}

/** Integer path parameter; anything else is treated as "not found". */
export function intParam(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, "Not found.");
  return n;
}
