import { defineConfig } from "@playwright/test";

// Assumes backend (:4000) and frontend (:3005) are already running with the seeded demo data.
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  // `npx playwright show-report` opens the HTML report (kept out of git: it can contain real names from the dev data).
  reporter: [["list"], ["html", { open: "never" }]],
  globalTeardown: "./e2e/global-teardown.ts",
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3005", screenshot: "only-on-failure" },
});
