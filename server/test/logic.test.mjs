import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluatePriority, CORE_FIELDS } from "../lib/priority.mjs";
import { DEFAULT_PARAMS, destinationPoint, haversineKm, rank } from "../lib/ranking.mjs";
import { createStore } from "../lib/store.mjs";
import { seed, DEMO_PATIENT_LOCATION } from "../lib/seed.mjs";
import { applyOutcome, checkTimeouts, startAllocation } from "../lib/allocation.mjs";

const ALL_NO = Object.fromEntries(CORE_FIELDS.map((f) => [f, "no"]));
const PAPER = { ...DEFAULT_PARAMS, wReliability: 0 };

test("each red flag alone gives RED_FLAG", () => {
  for (const f of CORE_FIELDS) assert.equal(evaluatePriority("cut", { ...ALL_NO, [f]: "yes" }, 30).category, "RED_FLAG");
});

test("a missing core answer is unknown, never no", () => {
  const { chest_pain: _skip, ...rest } = ALL_NO;
  assert.equal(evaluatePriority("cut", rest, 30).category, "NEEDS_REVIEW");
});

test("concerns give ELEVATED and age boundaries hold", () => {
  assert.equal(evaluatePriority("cut", { ...ALL_NO, minor_bleeding: "yes" }, 30).category, "ELEVATED");
  assert.equal(evaluatePriority("burn", ALL_NO, 30).category, "ELEVATED");
  assert.equal(evaluatePriority("cut", ALL_NO, 4).category, "ELEVATED");
  assert.equal(evaluatePriority("cut", ALL_NO, 65).category, "ELEVATED");
  assert.equal(evaluatePriority("cut", ALL_NO, 5).category, "STANDARD");
  assert.equal(evaluatePriority("cut", ALL_NO, 64).category, "STANDARD");
});

test("haversine and destination point agree", () => {
  assert.ok(Math.abs(haversineKm(0, 0, 0, 1) - 111.195) < 0.001);
  const [lat, lng] = destinationPoint(...DEMO_PATIENT_LOCATION, 120, 8.01);
  assert.ok(Math.abs(haversineKm(...DEMO_PATIENT_LOCATION, lat, lng) - 8.01) < 1e-6);
});

function seeded() {
  const store = createStore("/nonexistent/never-saved.json");
  seed(store);
  return store;
}

test("Table VIII worked example of the paper", () => {
  const store = seeded();
  const ranked = rank(...DEMO_PATIENT_LOCATION, "road_accident", store.all("hospitals"), new Set(), PAPER, Date.now());
  const names = ranked.map((c) => store.get("hospitals", c.hospital_id).name);
  assert.deepEqual(names, ["Pari Chowk Trauma Centre", "Alpha Care Hospital", "Knowledge Park Medical Centre"]);
  assert.ok(Math.abs(ranked[0].score - 0.776) < 1e-3);
  assert.ok(Math.abs(ranked[1].score - 0.621) < 1e-3);
  assert.ok(Math.abs(ranked[2].score - 0.366) < 1e-3);
  assert.equal(ranked[2].availability_flag, "missing");
});

test("Algorithm 1: decline and timeout move on, then no hospital is left", () => {
  const store = seeded();
  const [lat, lng] = DEMO_PATIENT_LOCATION;
  const request = store.insert("requests", { injury_type: "road_accident", lat, lng, status: "SUBMITTED" });
  const first = startAllocation(store, request);
  assert.equal(store.get("hospitals", first.hospital_id).name, "Pari Chowk Trauma Centre");
  applyOutcome(store, first, "REJECTED", { id: 99 }, "no_bed");
  const second = store.filter("assignments", (a) => a.status === "PENDING")[0];
  assert.equal(store.get("hospitals", second.hospital_id).name, "Alpha Care Hospital");
  assert.throws(() => applyOutcome(store, first, "ACCEPTED", { id: 99 }), /already been decided/);
  checkTimeouts(store, Date.now() + 121_000);
  checkTimeouts(store, Date.now() + 242_000);
  assert.equal(request.status, "NO_SUITABLE_HOSPITAL");
});

test("patient arrival closes the loop and notifies the reporter", async () => {
  const { markArrived } = await import("../lib/allocation.mjs");
  const store = seeded();
  const [lat, lng] = DEMO_PATIENT_LOCATION;
  const citizen = store.find("users", (u) => u.role === "citizen");
  const request = store.insert("requests", { reporter_id: citizen.id, public_code: "JS-TEST-1", priority: "ELEVATED", injury_type: "road_accident", lat, lng, status: "SUBMITTED" });
  const a = startAllocation(store, request);
  assert.throws(() => markArrived(store, a, { id: 9 }), /Only an accepted request/);
  applyOutcome(store, a, "ACCEPTED", { id: 9 });
  markArrived(store, a, { id: 9 });
  assert.equal(request.status, "PATIENT_ARRIVED");
  const texts = store.all("notifications").map((n) => n.text).join(" ");
  assert.match(texts, /accepted request JS-TEST-1/);
  assert.match(texts, /arrived at Pari Chowk Trauma Centre/);
  assert.ok(store.all("notifications").every((n) => !n.to.includes("9811024521")), "phone numbers are masked");
});

test("sensitive cases get minimal notification text", () => {
  const store = seeded();
  const [lat, lng] = DEMO_PATIENT_LOCATION;
  const citizen = store.find("users", (u) => u.role === "citizen");
  const request = store.insert("requests", { reporter_id: citizen.id, public_code: "JS-TEST-2", priority: "STANDARD", injury_type: "other", lat, lng, status: "SUBMITTED", sensitive: true });
  const a = startAllocation(store, request);
  applyOutcome(store, a, "ACCEPTED", { id: 9 });
  const sms = store.all("notifications").filter((n) => n.channel === "sms");
  assert.ok(sms.length > 0);
  assert.ok(sms.every((n) => !n.text.includes(store.get("hospitals", a.hospital_id).name)));
});

test("data freshness decays to stale after six hours", async () => {
  const { freshness } = await import("../lib/freshness.mjs");
  const now = Date.now();
  assert.equal(freshness(null).level, "missing");
  assert.equal(freshness(new Date(now - 10 * 60000).toISOString(), now).level, "fresh");
  assert.equal(freshness(new Date(now - 3 * 3600000).toISOString(), now).confidence, 0.5);
  assert.equal(freshness(new Date(now - 7 * 3600000).toISOString(), now).level, "stale");
});
