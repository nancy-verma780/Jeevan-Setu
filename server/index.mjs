/**
 * JeevanSetu portable server. Pure Node.js with no compiled add-ons, so it runs
 * on locked-down Windows laptops where native Python extensions are blocked.
 * It serves the same /api as the FastAPI backend, plus the built frontend.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { config } from "./lib/config.mjs";
import { createStore } from "./lib/store.mjs";
import { seed, DEMO_CITIZEN_PHONE, DEMO_STAFF_PASSWORD, DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD } from "./lib/seed.mjs";
import { createRouter, currentSession, requireRole } from "./lib/router.mjs";
import { HttpError, invalid, readBody, sendJson } from "./lib/http.mjs";
import { checkTimeouts } from "./lib/allocation.mjs";
import { analyzer, loadAnalyzer } from "./lib/analyzer.mjs";
import { registerAuth } from "./routes/auth.mjs";
import { registerCitizen } from "./routes/citizen.mjs";
import { registerStaff } from "./routes/staff.mjs";
import { registerAdmin } from "./routes/admin.mjs";
import { registerExtra } from "./routes/extra.mjs";
import { publish, subscribe } from "./lib/live.mjs";

const store = createStore(path.join(config.dataDir, "db.json"));
if (store.isEmpty()) {
  seed(store);
  store.save();
}

const router = createRouter();
router.get("/api/health", () => ({ body: { status: "ok" }, readOnly: true }));
router.get("/api/model", (ctx) => {
  ctx.user();
  return { body: analyzer.info(), readOnly: true };
});
registerAuth(router, store);
registerCitizen(router, store);
registerStaff(router, store);
registerAdmin(router, store);
registerExtra(router, store);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

function serveStatic(req, res, pathname) {
  if (!fs.existsSync(config.distDir)) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("JeevanSetu API is running. Open the app at http://localhost:5173 (npm run dev), or run npm start to build and serve it here.");
    return;
  }
  const safe = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = path.join(config.distDir, safe);
  if (!file.startsWith(config.distDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(config.distDir, "index.html"); // single-page app routes
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Cache-Control": file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
  });
  fs.createReadStream(file).pipe(res);
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/")) {
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res, url.pathname);
    return sendJson(res, 404, { detail: "Not found." });
  }
  if (url.pathname === "/api/stream" && req.method === "GET") {
    try {
      currentSession(store, req);
    } catch (error) {
      return sendJson(res, error.status ?? 401, { detail: error.detail ?? "Sign in to continue." });
    }
    return subscribe(req, res);
  }
  const found = router.match(req.method, url.pathname);
  if (!found) return sendJson(res, 404, { detail: "Not found." });

  let cachedUser = null;
  const ctx = {
    req,
    res,
    params: found.params,
    query: url.searchParams,
    markChanged: () => undefined,
    user() {
      if (!cachedUser) cachedUser = currentSession(store, req).user;
      return cachedUser;
    },
    async json() {
      const raw = await readBody(req, 1024 * 1024);
      if (!raw.length) return {};
      try {
        return JSON.parse(raw.toString("utf8"));
      } catch {
        throw invalid("The request body is not valid JSON.");
      }
    },
  };

  try {
    if (found.route.role) requireRole(ctx.user(), found.route.role);
    const result = (await found.route.handler(ctx)) ?? {};
    if (!result.readOnly) {
      store.save();
      if (req.method !== "GET") publish();
    }
    if (result.raw) {
      res.writeHead(result.status ?? 200, result.headers);
      res.end(result.raw);
      return;
    }
    sendJson(res, result.status ?? 200, result.body ?? null, result.headers);
  } catch (error) {
    store.save();
    if (error instanceof HttpError) {
      const body = { detail: error.detail };
      if (error.code) body.code = error.code;
      return sendJson(res, error.status, body);
    }
    console.error(error);
    sendJson(res, 500, { detail: "Something went wrong on the server." });
  }
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) sendJson(res, 500, { detail: "Something went wrong on the server." });
  });
});

// Background timeout checker. Single process, as the paper notes.
setInterval(() => {
  if (checkTimeouts(store)) {
    store.save();
    publish();
  }
}, config.timeoutPollMs).unref();

await loadAnalyzer();

server.listen(config.port, () => {
  const ui = process.env.JS_UI_URL ?? (fs.existsSync(config.distDir) ? `http://localhost:${config.port}` : "http://localhost:5173");
  console.log("");
  console.log(`  JeevanSetu server ready on http://localhost:${config.port}`);
  console.log(`  Open the app:      ${ui}/demo`);
  console.log(`  Citizen:  mobile ${DEMO_CITIZEN_PHONE.slice(3)} (code shown on screen)`);
  console.log(`  Staff:    staff.h3@jeevansetu.demo / ${DEMO_STAFF_PASSWORD}`);
  console.log(`  Admin:    ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
  const model = analyzer.info();
  console.log(model.loaded ? `  Wound model: loaded (${model.classes.join(", ")})` : "  Wound model: not installed, photos will be marked \"Not analysed\" (see server/models/README.md)");
  console.log("");
});
