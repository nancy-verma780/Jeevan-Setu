/** Deletes all saved data. The demo hospitals and accounts are created again on the next start. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "server", "data");
fs.rmSync(dataDir, { recursive: true, force: true });
console.log("Data cleared. The demo data will be loaded again when you start the app.");
