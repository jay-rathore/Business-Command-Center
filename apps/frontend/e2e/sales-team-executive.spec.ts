import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { apiAs, uiLogin, ROLES } from "./helpers";

// Per-executive drill-down: click an executive on Sales Team to see everything they worked on.
const ALL = "dateFrom=2000-01-01&dateTo=2099-01-01";
const ORG = `(select id from "Organization" where slug='hpl-maker')`;
function sql(q: string): number {
  const out = execFileSync("docker", ["exec", "hpl-command-center-postgres-1", "sh", "-c", `psql -U $POSTGRES_USER -d $POSTGRES_DB -At -c "${q.replace(/"/g, '\\"')}"`]).toString().trim();
  return Number(out);
}

let api: APIRequestContext;
let exec: { id: string; name: string; employeeCode: string };

test.beforeAll(async () => {
  api = await apiAs(ROLES.owner);
  const list = (await (await api.get("sales-team?q=CRM-U44&pageSize=5")).json()).data;
  exec = list[0];
});

const overview = async (q = ALL) => (await api.get(`sales-team/${exec.id}/overview?${q}`)).json();

test("an executive's numbers reconcile with the leads list and the database", async () => {
  const o = await overview();
  const bucket = (k: string) => o.outcomes.buckets.find((b: any) => b.key === k);

  const dbTotal = sql(`select count(*) from "Lead" where "organizationId"=${ORG} and "deletedAt" is null and "assignedExecId"='${exec.id}'`);
  expect(o.lead.total).toBe(dbTotal);
  expect(o.outcomes.total).toBe(dbTotal);
  expect(o.outcomes.buckets.reduce((s: number, b: any) => s + b.count, 0), "buckets add up to the executive's leads").toBe(dbTotal);

  // the same numbers the Leads list gives when filtered to this executive
  const lead = async (extra: string) => (await (await api.get(`leads?assignedExecId=${exec.id}&pageSize=1&${extra}`)).json()).meta.total;
  expect(await lead("")).toBe(dbTotal);
  expect(await lead("stage=WON")).toBe(o.lead.won);
  expect(await lead("stage=LOST")).toBe(o.lead.lost);
  expect(bucket("lost").statuses.reduce((s: number, r: any) => s + r.count, 0), "lost reasons add up to lost").toBe(o.lead.lost);

  expect(o.lead.worked).toBe(o.lead.total - bucket("new").count - bucket("other").count);
  expect(o.lead.interested).toBe(bucket("interested").count + bucket("qualified").count + bucket("won").count);
  expect(o.executive).toMatchObject({ id: exec.id, name: exec.name, employeeCode: "CRM-U44" });
});

test("team comparison uses the whole team's rates", async () => {
  const [o, team] = await Promise.all([overview(), (await api.get(`leads/outcomes?${ALL}`)).json()]);
  expect(o.teamRates).toEqual(team.rates);
  expect(o.outcomes.rates.map((r: any) => r.key)).toEqual(team.rates.map((r: any) => r.key));
});

test("per-source rows belong to this executive", async () => {
  const o = await overview();
  const noSource = o.sources.sources.find((s: any) => s.sourceId === null);
  expect(noSource?.leads ?? 0).toBe(
    sql(`select count(*) from "Lead" l where l."organizationId"=${ORG} and l."deletedAt" is null and l."assignedExecId"='${exec.id}' and not exists (select 1 from "LeadSourceOnLead" x where x."leadId"=l.id)`),
  );
  for (const s of o.sources.sources.filter((x: any) => x.sourceId).slice(0, 3)) {
    const list = await (await api.get(`leads?assignedExecId=${exec.id}&sourceId=${s.sourceId}&pageSize=1`)).json();
    expect(list.meta.total, s.source).toBe(s.leads);
  }
  expect(o.sources.sources.reduce((s: number, r: any) => s + r.leads, 0)).toBeGreaterThanOrEqual(o.lead.total);
});

test("monthly trend: at most 12 months, ascending, and the assigned counts are real", async () => {
  const o = await overview();
  expect(o.monthly.length).toBeGreaterThan(0);
  expect(o.monthly.length).toBeLessThanOrEqual(12);
  const months = o.monthly.map((m: any) => m.month);
  expect(months).toEqual([...months].sort());
  const m = o.monthly[0];
  expect(m.assigned).toBe(
    sql(`select count(*) from "Lead" where "organizationId"=${ORG} and "deletedAt" is null and "assignedExecId"='${exec.id}' and to_char(date_trunc('month',"createdAt"),'YYYY-MM')='${m.month}'`),
  );
  expect(o.monthly.reduce((s: number, x: any) => s + x.assigned, 0)).toBeLessThanOrEqual(o.lead.total);
});

test("the date range narrows everything", async () => {
  const all = await overview();
  const none = await overview("dateFrom=2099-01-01&dateTo=2099-12-31");
  expect(none.lead.total).toBe(0);
  expect(none.monthly).toEqual([]);
  const recent = await overview(`dateFrom=${new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)}&dateTo=2099-01-01`);
  expect(recent.lead.total).toBeLessThan(all.lead.total);
  expect(recent.lead.total).toBeGreaterThan(0);
});

test("unknown executive is a 404; access follows sales_team:read", async () => {
  expect((await api.get(`sales-team/does-not-exist/overview`)).status()).toBe(404);
  expect((await (await apiAs(ROLES.salesManager)).get(`sales-team/${exec.id}/overview`)).status()).toBe(200);
  for (const role of [ROLES.salesExec, ROLES.marketing, ROLES.dealerManager]) {
    expect((await (await apiAs(role)).get(`sales-team/${exec.id}/overview`)).status(), role).toBe(403);
  }
  const anon = await request.newContext({ baseURL: "http://localhost:4000/api/" });
  expect((await anon.get(`sales-team/${exec.id}/overview`)).status()).toBe(401);
});

test("an executive with no orders or projects still gets a complete, honest page", async () => {
  const o = await overview();
  expect(o.revenue).toMatchObject({ revenue: 0, orders: 0, avgOrderValue: null });
  expect(o.projects.total).toBe(0);
  expect(o.activity.total).toBe(0);
  expect(o.documents.quotations.count).toBe(0);
});

test.describe("UI", () => {
  const num = (n: number) => n.toLocaleString("en-IN");

  test("click an executive on the Sales Team page to see the full breakdown", async ({ page }) => {
    const o = await overview();
    await uiLogin(page, ROLES.owner);
    await page.goto("/sales-team");
    await page.getByPlaceholder(/search executive/i).fill("CRM-U44");
    await page.getByRole("link", { name: exec.name }).click();

    await expect(page).toHaveURL(new RegExp(`/sales-team/${exec.id}`));
    await expect(page.getByRole("heading", { name: exec.name, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /all time/i })).toBeVisible();

    const main = page.locator("main");
    await expect(main).toContainText(`Leads assigned${num(o.lead.total)}`);
    await expect(main).toContainText(`Won${num(o.lead.won)}`);
    await expect(main).toContainText(`Lost${num(o.lead.lost)}`);
    for (const section of ["Lead Outcomes", "Compared with the team", "Source Performance", "Month by month", "Overdue follow-ups", "Sales & pipeline", "Activity logged in this app"]) {
      await expect(main.getByText(section, { exact: true }).first()).toBeVisible();
    }
    await expect(main).toContainText("Declined"); // the lost reasons are listed
    await expect(page.getByTestId("monthly-trend")).toBeVisible();
  });

  test("Lost → View filters the executive's own leads table", async ({ page }) => {
    const o = await overview();
    await uiLogin(page, ROLES.owner);
    await page.goto(`/sales-team/${exec.id}`);
    await page.getByRole("listitem").filter({ hasText: "Lost" }).filter({ hasText: "Declined" }).getByRole("button", { name: "View" }).click();
    await expect(page.getByLabel("Filter by status")).toHaveValue("stage:LOST");
    await expect.poll(async () => (await page.locator("#exec-leads").getByText(/of [\d,]+$/).first().innerText()).replace(/,/g, "")).toContain(`of ${o.lead.lost}`);
  });

  test("a source's View link filters the table to that source", async ({ page }) => {
    const o = await overview();
    const src = o.sources.sources.find((s: any) => s.sourceId && s.leads > 50);
    await uiLogin(page, ROLES.owner);
    await page.goto(`/sales-team/${exec.id}`);
    await page.getByRole("row").filter({ hasText: src.source }).getByRole("button", { name: "View" }).click();
    await expect(page.getByLabel("Filter by source")).toHaveValue(src.sourceId);
    await expect.poll(async () => (await page.locator("#exec-leads").getByText(/of [\d,]+$/).first().innerText()).replace(/,/g, "")).toContain(`of ${src.leads}`);
  });

  test("the leaderboard and table rows both lead to the executive page; back returns", async ({ page }) => {
    await uiLogin(page, ROLES.owner);
    await page.goto("/sales-team");
    await page.locator("tbody tr").first().click();
    await expect(page).toHaveURL(/\/sales-team\/[^/?]+/);
    await page.getByRole("link", { name: /Sales Team/ }).first().click();
    await expect(page).toHaveURL(/\/sales-team(\?|$)/);
    await page.getByText("Top Performers").locator("..").locator("..").getByRole("button").first().click();
    await expect(page).toHaveURL(/\/sales-team\/[^/?]+/);
  });

  test("the date range applies to the executive page", async ({ page }) => {
    // the picker's "Last 30 days" is today and the 29 days before it
    const week = await overview(`dateFrom=${new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10)}&dateTo=2099-01-01`);
    await uiLogin(page, ROLES.owner);
    await page.goto(`/sales-team/${exec.id}`);
    await page.getByRole("button", { name: /all time/i }).click();
    await page.getByRole("menuitem", { name: "Last 30 days" }).click();
    await expect(page.locator("main")).toContainText(`Leads assigned${num(week.lead.total)}`);
  });

  test("a role without Sales Team access is shown access denied", async ({ page }) => {
    await uiLogin(page, ROLES.salesExec);
    await page.goto(`/sales-team/${exec.id}`);
    await expect(page.getByText("Access denied")).toBeVisible();
  });

  test("mobile: no horizontal overflow on the executive page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await uiLogin(page, ROLES.owner);
    await page.goto(`/sales-team/${exec.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: exec.name, exact: true })).toBeVisible();
    const over = await page.evaluate(() => {
      const m = document.querySelector("main")!;
      return { page: document.documentElement.scrollWidth - innerWidth, main: m.scrollWidth - m.clientWidth };
    });
    expect(over.page).toBeLessThanOrEqual(1);
    expect(over.main).toBeLessThanOrEqual(1);
  });
});
