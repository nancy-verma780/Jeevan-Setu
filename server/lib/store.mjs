import fs from "node:fs";
import path from "node:path";

const TABLES = [
  "users", "sessions", "otp", "hospitals", "requests", "consents", "events", "assignments", "audit", "images",
  "shares", "notifications", "feedback", "settings", "comments", "handover",
  // [FUTURE] data hooks: tables exist so later features need no migration. Nothing writes to them yet.
  "volunteers", "blood_donors", "crash_events", "corridor_requests",
];

/**
 * A small JSON-file database. Node runs request handlers one at a time, so each
 * check-then-update below is atomic, which is what the conditional updates of
 * Algorithm 1 need. Data is written to disk after every change.
 */
export function createStore(file) {
  let data = load();

  function empty() {
    const fresh = { seq: {} };
    for (const t of TABLES) {
      fresh[t] = [];
      fresh.seq[t] = 0;
    }
    return fresh;
  }

  function load() {
    if (!fs.existsSync(file)) return empty();
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const t of TABLES) {
      parsed[t] ??= [];
      parsed.seq[t] ??= 0;
    }
    return parsed;
  }

  return {
    isEmpty: () => data.hospitals.length === 0,
    all: (table) => data[table],
    get: (table, id) => data[table].find((row) => row.id === id) ?? null,
    find: (table, predicate) => data[table].find(predicate) ?? null,
    filter: (table, predicate) => data[table].filter(predicate),
    insert(table, row) {
      const id = ++data.seq[table];
      const record = { id, ...row };
      data[table].push(record);
      return record;
    },
    remove(table, predicate) {
      data[table] = data[table].filter((row) => !predicate(row));
    },
    save() {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data));
      fs.renameSync(tmp, file);
    },
    reset() {
      data = empty();
    },
  };
}
