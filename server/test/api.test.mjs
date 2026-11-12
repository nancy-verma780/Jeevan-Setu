// Integration test: starts the real server on a spare port with a temporary data folder.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 18000 + Math.floor(Math.random() * 1000);
const base = `http://localhost:${port}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "js-api-"));
let child;

class Client {
  cookie = "";
  async call(method, url, body, headers = {}) {
    const res = await fetch(base + url, {
      method,
      headers: { "content-type": "application/json", cookie: this.cookie, ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }
  async citizen(phone) {
    const otp = await this.call("POST", "/api/auth/otp/request", { phone });
    return this.call("POST", "/api/auth/otp/verify", { phone, code: otp.body.dev_code });
  }
  staff(email, password = "Demo@2026!") {
    return this.call("POST", "/api/auth/login", { email, password });
  }
}

const report = (extra = {}) => ({
  injury_type: "road_accident",
  symptoms: { unresponsive: "no", breathing_difficulty: "no", heavy_bleeding: "no", chest_pain: "no", seizure_now: "no", minor_bleeding: "yes" },
  location: { lat: 28.4744, lng: 77.504, source: "gps" },
  consent: { accepted: true, policy_version: "2026-10-01" },
  ...extra,
});
const submit = (c, extra) => c.call("POST", "/api/emergencies", report(extra), { "Idempotency-Key": `k${Math.random().toString(36).slice(2, 12)}` });

before(async () => {
  child = spawn(process.execPath, [path.join(root, "index.mjs")], { env: { ...process.env, JS_PORT: String(port), JS_DATA_DIR: dataDir, JS_REPORTS_PER_HOUR: "3" }, stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
});
after(() => {
  child.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("passport, share link, arrival, feedback and access log", async () => {
  const citizen = new Client();
  await citizen.citizen("9811024521");
  const saved = await citizen.call("PUT", "/api/me/passport", { blood_group: "B+", allergies: "Penicillin", conditions: "Diabetes", contacts: [{ name: "Riya", relation: "Sister", phone: "9876500100" }] });
  assert.equal(saved.status, 200);
  const created = await submit(citizen, { share_passport: true, patient_age: 40 });
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.ok(created.body.current_hospital.freshness.level);

  const share = await citizen.call("POST", `/api/emergencies/${id}/share`);
  const family = new Client();
  const tracked = await family.call("GET", `/api/track/${share.body.path.split("/").pop()}`);
  assert.equal(tracked.status, 200);
  assert.equal(tracked.body.hospital.name, "Pari Chowk Trauma Centre");
  assert.ok(!JSON.stringify(tracked.body).includes("Penicillin"), "family link shows no medical details");
  assert.equal((await family.call("GET", "/api/track/not-a-real-token")).status, 404);

  const staff = new Client();
  await staff.staff("staff.h3@jeevansetu.demo");
  const queue = await staff.call("GET", "/api/staff/requests");
  const aid = queue.body[0].assignment_id;
  const packet = await staff.call("GET", `/api/staff/requests/${aid}`);
  assert.equal(packet.body.packet.conditions, "Diabetes");
  assert.equal(packet.body.packet.emergency_contacts[0].name, "Riya");
  assert.equal((await staff.call("POST", `/api/staff/requests/${aid}/arrived`)).status, 409);
  await staff.call("POST", `/api/staff/requests/${aid}/decision`, { action: "accept" });
  assert.equal((await staff.call("POST", `/api/staff/requests/${aid}/arrived`)).status, 200);
  assert.equal((await citizen.call("GET", `/api/emergencies/${id}`)).body.status, "PATIENT_ARRIVED");

  assert.equal((await citizen.call("POST", `/api/emergencies/${id}/feedback`, { hospital_ready: "yes", info_correct: "yes" })).status, 201);
  assert.equal((await citizen.call("POST", `/api/emergencies/${id}/feedback`, { hospital_ready: "yes", info_correct: "yes" })).status, 409);
  const log = await citizen.call("GET", `/api/emergencies/${id}/access-log`);
  assert.ok(log.body.some((row) => row.action === "VIEW_CASE" && row.staff_name === "Ritu Sharma"));
});

test("report rate limit, admin insights, what-if, outbox and scorecard", async () => {
  const citizen = new Client();
  await citizen.citizen("9876500200");
  for (let i = 0; i < 3; i++) assert.equal((await submit(citizen)).status, 201);
  const limited = await submit(citizen);
  assert.equal(limited.status, 429);
  assert.equal(limited.body.code, "rate_limited");

  const admin = new Client();
  await admin.staff("admin@jeevansetu.demo", "Admin@2026!");
  const overview = await admin.call("GET", "/api/admin/overview");
  assert.equal(overview.body.per_hospital.length, 5);
  const insights = await admin.call("GET", "/api/admin/insights");
  assert.ok(Array.isArray(insights.body.by_area));
  const whatif = await admin.call("POST", "/api/admin/whatif", { wd: 1, wr: 0, dmax: 25, bcap: 5 });
  assert.ok(whatif.body.changed >= 1, "distance-only weights send trauma cases to the nearer Alpha Care Hospital");
  const outbox = await admin.call("GET", "/api/admin/notifications");
  assert.ok(outbox.body.length > 0 && outbox.body.every((n) => n.status === "sent (mock)"));
  const rows = await admin.call("GET", "/api/admin/requests");
  assert.ok(rows.body.every((r) => typeof r.reporter_trust === "number"));
  const anonymous = new Client();
  const card = await anonymous.call("GET", "/api/public/scorecard");
  assert.equal(card.status, 200);
  assert.ok(!JSON.stringify(card.body).includes("JS-"), "scorecard has no case data");
});

test("live updates stream needs a session", async () => {
  const res = await fetch(`${base}/api/stream`);
  assert.equal(res.status, 401);
});

test("surge mode widens the radius, readiness expires, comments stay inside one hospital", async () => {
  const admin = new Client();
  await admin.staff("admin@jeevansetu.demo", "Admin@2026!");
  const citizen = new Client();
  await citizen.citizen("9876500300");
  const drill = () => citizen.call("POST", "/api/drill/preview", { injury_type: "burn", symptoms: {}, location: { lat: 28.4744, lng: 77.504, source: "gps" } });
  assert.equal((await drill()).body.candidates.length, 1, "only Knowledge Park offers burn care within 25 km");
  assert.equal((await admin.call("PUT", "/api/admin/surge", { active: true, message: "Major accident on the expressway", radius_km: 40 })).status, 200);
  assert.equal((await citizen.call("GET", "/api/broadcast")).body.message, "Major accident on the expressway");
  assert.equal((await drill()).body.candidates.length, 2, "Dadri Road (30 km) qualifies during surge");
  await admin.call("PUT", "/api/admin/surge", { active: false, radius_km: 40 });
  assert.equal((await drill()).body.candidates.length, 1);

  const staff = new Client();
  await staff.staff("staff.h3@jeevansetu.demo");
  const ready = await staff.call("PUT", "/api/staff/readiness", { item: "trauma_surgeon", available: true });
  assert.equal(ready.body.readiness.trauma_surgeon.state, "available");
  assert.equal(ready.body.readiness.ot_free.state, "unknown");

  const created = await submit(citizen);
  const aid = (await staff.call("GET", "/api/staff/requests")).body.find((r) => r.request_code === created.body.public_code).assignment_id;
  assert.equal((await staff.call("POST", `/api/staff/requests/${aid}/comments`, { text: "Keep trauma bay 2 ready" })).status, 201);
  assert.equal((await staff.call("GET", `/api/staff/requests/${aid}/comments`)).body[0].author, "Ritu Sharma");
  const other = new Client();
  await other.staff("staff.h1@jeevansetu.demo");
  assert.equal((await other.call("GET", `/api/staff/requests/${aid}/comments`)).status, 404);
  assert.equal((await staff.call("POST", "/api/staff/handover", { text: "Night shift: OT 2 under maintenance." })).status, 201);
  assert.equal((await other.call("GET", "/api/staff/handover")).body.length, 0, "handover notes stay within one hospital");
});
