import { test, expect } from "@playwright/test";

const ROUTES = [
  "dashboard", "sales", "marketing", "leads", "customers", "products", "projects", "quotations",
  "architects", "builders", "dealers", "sales-team", "geography", "complaints", "warranty",
  "reports", "ai-insights", "notifications", "scan-card", "settings",
];

test("rejects bad login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@hplmaker.demo");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated user is redirected to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("every page loads clean after login", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`${r.status()} ${r.url()}`));

  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@hplmaker.demo");
  await page.getByLabel("Password").fill("Passw0rd!123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  for (const route of ROUTES) {
    await page.goto(`/${route}`);
    await page.waitForLoadState("networkidle");
    await expect(page, route).toHaveURL(new RegExp(`/${route}`));
    await expect(page.getByText(/application error|something went wrong/i), route).toHaveCount(0);
  }
  expect(problems).toEqual([]);
});
