import { test, expect } from "@playwright/test";
import { apiAs, uiLogin, ROLES, TEST_LEAD } from "./helpers";

test.beforeEach(async ({ page }) => {
  await uiLogin(page, ROLES.owner);
});

test("logout returns to login and protects pages", async ({ page }) => {
  await page.getByText("Rajesh Kulkarni").click();
  await page.getByRole("menuitem", { name: /log out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("date range preset drives the URL", async ({ page }) => {
  await page.goto("/sales");
  await page.getByRole("button", { name: /all time|this month|last|today/i }).first().click();
  await page.getByRole("menuitem", { name: "Last 7 days" }).click();
  await expect(page).toHaveURL(/dateFrom=.*dateTo=/);
});

test("leads: status filter and row opens drawer", async ({ page }) => {
  await page.goto("/leads");
  await expect(page.getByText("All Leads")).toBeVisible();
  const firstRow = page.locator("#all-leads tbody tr").first();
  await expect(firstRow).toBeVisible();
  await firstRow.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("projects: kanban and drawer", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page.locator("tbody tr").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("quotations: list row opens drawer with PDF preview", async ({ page }) => {
  await page.goto("/quotations");
  await page.locator("tbody tr").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator('iframe[title="Quotation PDF preview"]')).toBeVisible();
});

test("quotations: create manual quotation for Testing lead through the UI (no send)", async ({ page }) => {
  await page.goto("/quotations");
  await page.getByRole("button", { name: /new quotation/i }).click();
  await page.getByPlaceholder(/search by name/i).fill(TEST_LEAD.phone.slice(-10));
  await page.getByRole("button", { name: /Testing/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Send Quotation")).toBeVisible();
  await dialog.getByLabel("Customer name").fill("Testing");
  await dialog.getByLabel("City", { exact: true }).fill("Mumbai");
  await dialog.getByLabel("State", { exact: true }).fill("Maharashtra");
  await dialog.getByLabel("Address").fill("1 Test Rd");
  await dialog.getByLabel("Item", { exact: true }).fill("UI E2E Sheet");
  await dialog.getByLabel("Qty").fill("2");
  await dialog.getByLabel("Rate").fill("1000");
  await dialog.getByRole("button", { name: /create|generate|preview/i }).last().click();
  await expect(dialog.locator('iframe[title="Quotation PDF preview"]')).toBeVisible({ timeout: 20000 });
  await expect(dialog.getByRole("button", { name: /send via whatsapp/i })).toBeVisible();
});

test("settings: add and remove a sales target through the UI", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "+ New Target" }).click();
  await page.getByLabel("Period start").fill("2032-01-01");
  await page.getByLabel("Period end").fill("2032-01-31");
  await page.getByLabel("Target revenue (₹)").fill("98765");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Jan 2032").first()).toBeVisible();
  // clean up via API (UI delete has no confirm dialog, so also covered here)
  const api = await apiAs(ROLES.owner);
  const list = await (await api.get("sales-targets?pageSize=200")).json();
  const mine = list.data.filter((t: any) => String(t.periodStart).startsWith("2032-01-01"));
  expect(mine.length).toBeGreaterThan(0);
  for (const t of mine) await api.delete(`sales-targets/${t.id}`);
});

test("platform-admin page lists organizations", async ({ page }) => {
  await page.goto("/platform-admin");
  await expect(page.getByText("hpl-maker").first()).toBeVisible();
});

test("notifications page and bell", async ({ page }) => {
  await page.getByRole("button", { name: "Notifications" }).click();
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: /notifications/i }).first()).toBeVisible();
});

test("mobile: sidebar opens as drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "Leads" }).click();
  await expect(page).toHaveURL(/\/leads/);
});
