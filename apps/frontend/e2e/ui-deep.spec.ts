import { test, expect, type Page } from "@playwright/test";
import { apiAs, uiLogin, ROLES, TEST_LEAD } from "./helpers";

test.beforeEach(async ({ page }) => {
  await uiLogin(page, ROLES.owner);
});

const total = async (page: Page) => {
  const text = await page.getByText(/of [\d,]+$/).first().innerText();
  return Number(text.match(/of ([\d,]+)/)![1].replace(/,/g, ""));
};

test("leads table: search, status filter, sort and pagination", async ({ page }) => {
  await page.goto("/leads");
  await expect(page.locator("#all-leads tbody tr").first()).toBeVisible();
  const all = await total(page);

  const search = page.getByPlaceholder(/search name, company or phone/i);
  await search.fill("8770375891");
  await expect.poll(() => total(page)).toBeLessThan(all);
  await expect(page.locator("#all-leads tbody tr").first()).toContainText("Testing");
  await search.fill("");
  await expect.poll(() => total(page)).toBe(all);

  const select = page.locator("select").first();
  await select.selectOption({ index: 1 });
  await expect.poll(() => total(page), "status filter").toBeLessThan(all);
  await select.selectOption({ index: 0 });
  await expect.poll(() => total(page)).toBe(all);

  const before = await page.locator("#all-leads tbody tr").first().innerText();
  await page.getByRole("columnheader", { name: /^Score/ }).click();
  await expect.poll(async () => page.locator("#all-leads tbody tr").first().innerText()).not.toBe(before);

  await page.locator("button:has(svg.lucide-chevron-right)").last().click();
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
});

test("lead drawer: log an activity on the Testing lead", async ({ page }) => {
  await page.goto("/leads");
  await page.getByPlaceholder(/search name, company or phone/i).fill("8770375891");
  await page.locator("#all-leads tbody tr", { hasText: TEST_LEAD.name }).first().click();
  const dialog = page.getByRole("dialog");
  const note = `e2e ui note ${Date.now()}`;
  await dialog.getByPlaceholder(/add a note/i).fill(note);
  await dialog.getByRole("button", { name: "Log activity" }).click();
  await expect(dialog.getByText(note)).toBeVisible();
});

test("dealers: status tabs filter the table", async ({ page }) => {
  await page.goto("/dealers");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page.getByRole("button", { name: "Inactive", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  for (const t of await page.locator("tbody tr td:last-child").allInnerTexts()) expect(t).toMatch(/inactive/i);
  await page.getByRole("button", { name: "Active", exact: true }).click();
  await expect(page.getByText("0 results")).toBeVisible();
});

test("products: search narrows the list", async ({ page }) => {
  await page.goto("/products");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  const all = await total(page);
  await page.getByPlaceholder(/search/i).first().fill("Walnut");
  await expect.poll(() => total(page)).toBeLessThan(all);
  for (const t of await page.locator("tbody tr td:first-child").allInnerTexts()) expect(t.toLowerCase()).toContain("walnut");
});

test("projects: move stage from the drawer and put it back", async ({ page }) => {
  const api = await apiAs(ROLES.owner);
  const p = (await (await api.get("projects?pageSize=1")).json()).data[0];
  const to = p.stage === "DISCOVERY" ? "SAMPLE" : "DISCOVERY";
  await page.goto("/projects");
  await page.getByPlaceholder(/search/i).first().fill(p.name.slice(0, 12));
  await page.locator("tbody tr").first().click();
  const stage = page.getByRole("dialog").locator("select");
  await stage.selectOption(to);
  await expect.poll(async () => (await (await api.get(`projects/${p.id}`)).json()).stage).toBe(to);
  await stage.selectOption(p.stage);
  await expect.poll(async () => (await (await api.get(`projects/${p.id}`)).json()).stage).toBe(p.stage);
});

test("notifications: mark all read clears the unread count", async ({ page }) => {
  await page.goto("/notifications");
  await page.getByRole("button", { name: /mark all/i }).click();
  const api = await apiAs(ROLES.owner);
  await expect.poll(async () => Number(await (await api.get("notifications/unread-count")).json())).toBe(0);
});

test("platform admin: create tenant, reset password, deactivate", async ({ page }) => {
  const slug = `e2e-ui-${Date.now()}`;
  await page.goto("/platform-admin");
  await page.getByRole("button", { name: "+ New Organization" }).click();
  await page.getByLabel("Organization name").fill("E2E UI Tenant");
  await page.getByLabel("Slug").fill(slug);
  await page.getByLabel("Admin name").fill("E2E Admin");
  await page.getByLabel("Admin email").fill(`${slug}@example.test`);
  await page.getByRole("button", { name: "Create organization" }).click();
  // Regression: the one-time admin-password dialog used to vanish with the form that owned it.
  const pw = page.getByRole("dialog");
  await expect(pw).toBeVisible();
  await expect(pw).toContainText(`${slug}@example.test`);
  await page.keyboard.press("Escape");
  const row = page.locator("div", { hasText: "E2E UI Tenant" }).filter({ has: page.getByRole("button", { name: /reset/i }) }).last();
  await row.getByRole("button", { name: /reset/i }).click();
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await row.getByRole("button", { name: /suspend/i }).click();
  await expect(row.getByRole("button", { name: /reactivate/i }).first()).toBeVisible();
});

test("scan business card: image is read and the review form is prefilled (no lead created)", async ({ page }) => {
  await page.setContent(`<body style="margin:0"><div style="width:700px;height:400px;background:#fff;padding:40px;font:28px Arial">
    <b style="font-size:40px">Asha Kulkarni</b><br>Founder, Kulkarni Designs LLP<br><br>
    Phone: +91 91234 56789<br>Email: asha@kulkarnidesigns.example<br>5 FC Road, Pune, Maharashtra</div></body>`);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 780, height: 480 } });
  await page.goto("/scan-card");
  await page.getByRole("button", { name: "Scan Business Card" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "card.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: /scan|extract/i }).last().click();
  await expect(page.getByLabel("Name")).toHaveValue(/Asha/, { timeout: 60000 });
  await expect(page.getByLabel("Email")).toHaveValue(/^asha@kulkarn/); // vision OCR may drop a letter — the review step exists for that
  await expect(page.getByRole("button", { name: "Create Lead" })).toBeVisible();
});

test("marketing page renders without errors", async ({ page }) => {
  await page.goto("/marketing");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Marketing", exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText(/Traffic|Website|Campaign/i);
  await expect(page.getByText(/application error|something went wrong/i)).toHaveCount(0);
});

// Mobile: no page may overflow horizontally.
for (const route of ["dashboard", "sales", "leads", "quotations", "marketing", "sales-team", "dealers", "projects", "customers", "products", "settings", "notifications"]) {
  test(`mobile layout has no horizontal overflow: /${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`/${route}`);
    await page.waitForLoadState("networkidle");
    const over = await page.evaluate(() => {
      const m = document.querySelector("main")!;
      return { page: document.documentElement.scrollWidth - innerWidth, main: m.scrollWidth - m.clientWidth };
    });
    expect(over.page, `${route} page overflow px`).toBeLessThanOrEqual(1);
    expect(over.main, `${route} main overflow px`).toBeLessThanOrEqual(1);
  });
}

test("quotation dialog: Chat AI tab parses text into the form", async ({ page }) => {
  await page.goto("/quotations");
  await page.getByRole("button", { name: /new quotation/i }).click();
  await page.getByPlaceholder(/search by name/i).fill("8770375891");
  await page.getByRole("button", { name: /Testing/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Chat AI" }).click();
  await dialog.getByPlaceholder(/Quote for Vivek Interiors/).fill("Quote for Vivek Interiors, Palghar - 20 sheets Walnut Brown HPL at 1800 each");
  await dialog.getByRole("button", { name: "Parse with AI" }).click();
  await expect(dialog.getByLabel("Qty").first()).toHaveValue("20", { timeout: 60000 });
  await expect(dialog.getByLabel("Rate").first()).toHaveValue("1800");
});

test("traffic intelligence: ask the AI a question in the UI", async ({ page }) => {
  await page.goto("/marketing");
  await page.getByRole("tab", { name: "Website & Search" }).click();
  await page.getByPlaceholder(/Why was my website traffic/).fill("Why did traffic change recently?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.locator("main")).toContainText(/visitors|traffic (rose|fell|dropped|increased)|compared/i, { timeout: 60000 });
});

test("date picker: custom range applies to the URL", async ({ page }) => {
  await page.goto("/sales");
  await page.getByRole("button", { name: /all time/i }).click();
  await page.getByRole("menuitem", { name: /custom range/i }).click();
  await page.locator('input[type="date"]').first().fill("2026-01-01");
  await page.locator('input[type="date"]').nth(1).fill("2026-03-31");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/dateFrom=2026-01-01&dateTo=2026-03-31/);
  await expect(page.getByRole("button", { name: /2026-01-01 – 2026-03-31/ })).toBeVisible();
});
