import { request, expect, type APIRequestContext } from "@playwright/test";

export const API = process.env.API_URL ?? "http://localhost:4000/api";
export const PASSWORD = "Passw0rd!123";

// Seeded demo users (apps/backend/prisma/seed.ts) and the modules each role may read,
// mirroring src/rbac/role-permission-matrix.ts.
export const ROLES = {
  owner: "owner@hplmaker.demo",
  admin: "admin@hplmaker.demo",
  salesManager: "sales.manager@hplmaker.demo",
  salesExec: "sales.exec@hplmaker.demo",
  marketing: "marketing@hplmaker.demo",
  dealerManager: "dealer.manager@hplmaker.demo",
} as const;

// The one lead all tests may message — never a real customer.
export const TEST_LEAD = { name: "Testing", phone: "+918770375891", email: "jaynayakjk@gmail.com" };

export async function apiAs(email: string): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: API + "/" });
  const res = await ctx.post("auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok(), `login ${email}: ${res.status()}`).toBeTruthy();
  return ctx;
}

export async function uiLogin(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
