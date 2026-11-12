/** Starts the API server and the Vite dev server together. Ctrl + C stops both. */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const children = [];

function start(name, args, cwd) {
  const child = spawn(process.execPath, args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, JS_UI_URL: "http://localhost:5173" } });
  const prefix = name === "api" ? "[api] " : "[web] ";
  child.stdout.on("data", (d) => process.stdout.write(d.toString().replace(/^(?=.)/gm, prefix)));
  child.stderr.on("data", (d) => process.stderr.write(d.toString().replace(/^(?=.)/gm, prefix)));
  child.on("exit", (code) => {
    console.log(`${prefix}stopped (${code ?? "signal"})`);
    stopAll();
  });
  children.push(child);
}

function stopAll() {
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exit(0);
}

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

start("api", [path.join(root, "server", "index.mjs")], root);
start("web", [path.join(root, "frontend", "node_modules", "vite", "bin", "vite.js"), "--port", "5173", "--strictPort"], path.join(root, "frontend"));
console.log("\n  Starting JeevanSetu. When both are ready, open http://localhost:5173/demo\n");
