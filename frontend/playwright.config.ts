import { defineConfig, devices } from "@playwright/test";

/**
 * Runs the real stack: the Node server with fresh seed data on :8000 and the
 * production build on :4173 (which proxies /api).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: [
    { name: "citizen-mobile", use: { ...devices["Pixel 5"], browserName: "chromium" }, testMatch: /citizen\.spec\.ts/ },
    { name: "staff-desktop", use: { viewport: { width: 1440, height: 900 } }, testMatch: /staff\.spec\.ts/ },
  ],
  webServer: [
    {
      // The portable Node server with a fresh data folder each run.
      command: "node -e \"require('fs').rmSync('../server/e2e-data',{recursive:true,force:true})\" && node ../server/index.mjs",
      env: { JS_DATA_DIR: "../server/e2e-data", JS_PORT: "8000" },
      url: "http://localhost:8000/api/health",
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: "npm run build && npx vite preview --port 4173 --strictPort",
      url: "http://localhost:4173",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
