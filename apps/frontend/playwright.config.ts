import { defineConfig } from "@playwright/test";

// Assumes backend (:4000) and frontend (:3005) are already running with the seeded demo data.
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  globalTeardown: "./e2e/global-teardown.ts",
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3005", screenshot: "only-on-failure" },
});
