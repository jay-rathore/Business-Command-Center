import { test, expect } from "@playwright/test";
import { apiAs, ROLES } from "./helpers";

// endpoint -> roles allowed to read it (module-level matrix; OWNER/ADMIN get everything)
const ALL = ["owner", "admin"];
const ENDPOINTS: Record<string, string[]> = {
  "dashboard/summary": [...ALL, "salesManager", "salesExec", "marketing", "dealerManager"],
  "dashboard/revenue-trend": [...ALL, "salesManager", "salesExec", "marketing", "dealerManager"],
  "sales/overview": [...ALL, "salesManager"],
  "leads": [...ALL, "salesManager", "salesExec", "marketing"],
  "quotations": [...ALL, "salesManager", "salesExec", "marketing"], // gated on leads:read
  "projects": [...ALL, "salesManager", "salesExec"],
  "sales-team": [...ALL, "salesManager"],
  "architects": [...ALL, "salesManager"],
  "builders": [...ALL, "salesManager"],
  "customers": [...ALL, "salesManager", "salesExec"],
  "products": [...ALL, "salesManager"],
  "marketing": [...ALL, "marketing"],
  "dealers": [...ALL, "dealerManager"],
  "notifications": [...ALL, "salesManager", "salesExec", "marketing", "dealerManager"],
  "sales-targets": ALL, // settings:read
  "company-profiles": ALL,
};

test("unauthenticated API calls are rejected", async ({ playwright }) => {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:4000/api/" });
  for (const path of Object.keys(ENDPOINTS)) {
    expect((await ctx.get(path)).status(), path).toBe(401);
  }
});

for (const [role, email] of Object.entries(ROLES)) {
  test(`RBAC matrix: ${role}`, async () => {
    const ctx = await apiAs(email);
    const wrong: string[] = [];
    for (const [path, allowed] of Object.entries(ENDPOINTS)) {
      const status = (await ctx.get(path)).status();
      const want = allowed.includes(role) ? 200 : 403;
      if (status !== want) wrong.push(`${path}: got ${status}, want ${want}`);
    }
    expect(wrong).toEqual([]);
  });
}

test("only a platform admin can use platform-admin API", async () => {
  expect((await (await apiAs(ROLES.owner)).get("platform-admin/organizations")).status()).toBe(200);
  for (const e of [ROLES.salesManager, ROLES.marketing, ROLES.dealerManager]) {
    expect((await (await apiAs(e)).get("platform-admin/organizations")).status(), e).toBe(403);
  }
});

test("write endpoints are blocked for read-only roles", async () => {
  const mkt = await apiAs(ROLES.marketing); // leads:read only
  expect((await mkt.post("leads", { data: { name: "x", phone: "12345", state: "a", city: "b", saveImage: false } })).status()).toBe(403);
  const exec = await apiAs(ROLES.salesExec); // no settings
  expect((await exec.post("sales-targets", { data: {} })).status()).toBe(403);
});

test("UI: forbidden pages show access denied, sidebar hides them", async ({ page }) => {
  const { uiLogin } = await import("./helpers");
  await uiLogin(page, ROLES.dealerManager);
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link", { name: "Dealers" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Leads" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Platform Admin" })).toHaveCount(0);
  for (const route of ["sales", "leads", "settings", "platform-admin"]) {
    await page.goto(`/${route}`);
    await expect(page.getByText("Access denied"), route).toBeVisible();
  }
  await page.goto("/dealers");
  await expect(page.getByText("Access denied")).toHaveCount(0);
});
