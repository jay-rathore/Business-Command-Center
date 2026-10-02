import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { apiAs, uiLogin, ROLES } from "./helpers";

// Compares what the API/UI report against the database itself. Needs the local Docker postgres.
const ORG = `(select id from "Organization" where slug='hpl-maker')`;
function sql(q: string): number {
  const out = execFileSync("docker", [
    "exec", "hpl-command-center-postgres-1", "sh", "-c",
    `psql -U $POSTGRES_USER -d $POSTGRES_DB -At -c "${q.replace(/"/g, '\\"')}"`,
  ]).toString().trim();
  return Number(out);
}
const count = (table: string, extra = "") => sql(`select count(*) from "${table}" where "organizationId"=${ORG} ${extra}`);

test("leads KPIs match the database", async () => {
  const api = await apiAs(ROLES.owner);
  const k = await (await api.get("leads/kpis")).json();
  expect(k.totalLeads).toBe(count("Lead", `and "deletedAt" is null`));
  expect(k.won + k.lost + k.pending).toBe(k.totalLeads);
  expect(k.qualified).toBeLessThanOrEqual(k.totalLeads);
  expect(k.conversionRate).toBeCloseTo((k.won / (k.won + k.lost)) * 100, 5);
});

test("leads list total == KPI total, and narrower date range never exceeds it", async () => {
  const api = await apiAs(ROLES.owner);
  const k = await (await api.get("leads/kpis")).json();
  const list = await (await api.get("leads?pageSize=1")).json();
  expect(list.meta.total).toBe(k.totalLeads);
  const week = await (await api.get(`leads/kpis?dateFrom=${new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)}&dateTo=${new Date().toISOString().slice(0, 10)}`)).json();
  expect(week.totalLeads).toBeLessThanOrEqual(k.totalLeads);
});

test("products, dealers, customers, projects KPIs match the database", async () => {
  const api = await apiAs(ROLES.owner);
  const [p, d, c, pr] = await Promise.all(
    ["products/stats/summary", "dealers/kpis", "customers/kpis", "projects/kpis"].map(async (u) => (await api.get(u)).json()),
  );
  expect(p.totalSkus).toBe(count("Product", `and "deletedAt" is null`));
  expect(d.totalDealers).toBe(count("Dealer", `and "deletedAt" is null`));
  expect(d.activeDealers + d.newDealers + d.atRiskDealers + d.inactiveDealers).toBe(d.totalDealers);
  expect(c.totalCustomers).toBe(count("Customer", `and "deletedAt" is null`));
  expect(c.activeCustomers + c.atRiskCustomers + c.dormantCustomers).toBe(c.totalCustomers);
  expect(pr.totalProjects).toBe(count("Project", `and "deletedAt" is null`));
});

test("Products total orders equals distinct orders", async () => {
  const api = await apiAs(ROLES.owner);
  const p = await (await api.get("products/stats/summary")).json();
  expect(p.totalOrders).toBe(count("Order", `and status<>'CANCELLED'`));
  expect(p.totalRevenue).toBeCloseTo(sql(`select coalesce(sum(i."lineTotal"),0) from "OrderItem" i join "Order" o on o.id=i."orderId" where o."organizationId"=${ORG} and o.status<>'CANCELLED'`), 0);
});

test("UI shows the API's numbers", async ({ page }) => {
  const api = await apiAs(ROLES.owner);
  const fmt = (n: number) => n.toLocaleString("en-IN");
  await uiLogin(page, ROLES.owner);
  const k = await (await api.get("leads/kpis")).json();
  await page.goto("/leads");
  await expect(page.getByText(fmt(k.totalLeads), { exact: true }).first()).toBeVisible();
  const d = await (await api.get("dealers/kpis")).json();
  await page.goto("/dealers");
  await expect(page.locator("main")).toContainText(`Total Dealers${d.totalDealers}Active`);
});

// Regression: pages used to show the current month (₹0 / "no trend data") while the picker said
// "All time", until the user picked a range. Opening them bare must land on an explicit all-time range.
for (const route of ["dashboard", "sales", "sales-team", "leads", "customers", "dealers", "products", "marketing"]) {
  test(`opens with all-time data, no range pick needed: /${route}`, async ({ page }) => {
    await uiLogin(page, ROLES.owner);
    await page.goto(`/${route}`);
    await expect(page).toHaveURL(/dateFrom=2000-01-01&dateTo=/);
    await expect(page.getByRole("button", { name: /all time/i })).toBeVisible();
  });
}

test("dashboard and sales show revenue on first load", async ({ page }) => {
  const api = await apiAs(ROLES.owner);
  const all = await (await api.get(`sales/overview?dateFrom=2000-01-01&dateTo=${new Date().toISOString().slice(0, 10)}`)).json();
  expect(all.revenue).toBeGreaterThan(0);
  await uiLogin(page, ROLES.owner);
  for (const route of ["dashboard", "sales"]) {
    await page.goto(`/${route}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).not.toContainText("No trend data yet");
    await expect(page.locator("main")).not.toContainText(/Revenue[^₹]{0,40}₹0(?![\d.,])/);
  }
});

test("sales team leaderboard has revenue on first load", async ({ page }) => {
  await uiLogin(page, ROLES.owner);
  await page.goto("/sales-team");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main")).not.toContainText(/Team Revenue\s*₹0(?![\d.,])/);
});

test("cancelled orders are excluded everywhere; Sales table, Products and Sales breakdown agree", async () => {
  const api = await apiAs(ROLES.owner);
  const today = new Date().toISOString().slice(0, 10);
  const range = `dateFrom=2000-01-01&dateTo=${today}`;
  const products = await (await api.get(`products/stats/summary?${range}`)).json();
  const table = await (await api.get(`sales/table?pageSize=200&${range}`)).json();
  const tableTotal = table.data.reduce((s: number, r: any) => s + r.revenue, 0);
  expect(tableTotal).toBeCloseTo(products.totalRevenue, 0);
  const top10 = [...table.data].sort((x: any, y: any) => y.revenue - x.revenue).slice(0, 10).map((r: any) => r.revenue);
  const breakdown = await (await api.get(`sales/breakdown?by=product&${range}`)).json();
  expect(breakdown.map((r: any) => r.revenue)).toEqual(top10); // breakdown is the top 10 products
});

test("sales table follows the date range", async () => {
  const api = await apiAs(ROLES.owner);
  const sum = async (q: string) => (await (await api.get(`sales/table?pageSize=200&${q}`)).json()).data.reduce((s: number, r: any) => s + r.revenue, 0);
  const all = await sum("dateFrom=2000-01-01&dateTo=2099-01-01");
  const none = await sum("dateFrom=2099-01-01&dateTo=2099-12-31");
  const some = await sum("dateFrom=2026-01-01&dateTo=2026-03-31");
  expect(none).toBe(0);
  expect(some).toBeGreaterThan(0);
  expect(some).toBeLessThan(all);
});

// Regression: the funnel started at 20,875 (not the 32,181 total), listed HR/junk CRM statuses
// ("Applied", "Jan"…) as stages, and treated same-tier statuses as ordered steps.
test("leads funnel reconciles with the KPI cards and hides non-pipeline statuses", async ({ page }) => {
  const api = await apiAs(ROLES.owner);
  const [funnel, kpis, statuses] = await Promise.all([
    (await api.get("leads/funnel")).json(),
    (await api.get("leads/kpis")).json(),
    (await api.get("leads/statuses")).json(),
  ]);
  expect(funnel[0]).toMatchObject({ label: "All leads", count: kpis.totalLeads });
  expect(funnel.at(-1).count, "last bar = won").toBe(kpis.won);
  const counts: number[] = funnel.map((f: any) => f.count);
  expect(counts, "a funnel never grows").toEqual([...counts].sort((a, b) => b - a));
  expect(funnel[1].count, "lost leads are not in the pipeline").toBeLessThanOrEqual(kpis.totalLeads - kpis.lost);

  const hidden = ["Applied", "Screening", "Offer Sent", "Rejected", "Hired", "Fd", "Dsf", "H", "Jan"];
  const labels = [...funnel.map((f: any) => f.label), ...funnel.flatMap((f: any) => f.statuses), ...statuses.map((s: any) => s.name)];
  for (const h of hidden) expect(labels, `${h} must not show`).not.toContain(h);

  await uiLogin(page, ROLES.owner);
  await page.goto("/leads");
  await expect(page.getByText("Conversion Funnel")).toBeVisible();
  await expect(page.locator("main")).toContainText(`All leads${kpis.totalLeads.toLocaleString("en-IN")}`);
  // (The Outcomes panel names them on purpose, under "Other / unclassified" — only the funnel chart must not.)
  const chart = page.locator("div.rounded-sm, div").filter({ has: page.getByText("Conversion Funnel", { exact: true }) }).last();
  await expect(chart).not.toContainText(/Applied|Offer Sent|Rejected|Screening/);
});

test("lead outcomes: buckets add up to the total and agree with the KPI cards and lost filter", async ({ page }) => {
  const api = await apiAs(ROLES.owner);
  const [o, kpis] = await Promise.all([(await api.get("leads/outcomes")).json(), (await api.get("leads/kpis")).json()]);
  const by = Object.fromEntries(o.buckets.map((b: any) => [b.key, b]));
  expect(o.total).toBe(kpis.totalLeads);
  expect(o.buckets.reduce((s: number, b: any) => s + b.count, 0), "buckets are exclusive and exhaustive").toBe(kpis.totalLeads);
  expect(by.won.count).toBe(kpis.won);
  expect(by.lost.count).toBe(kpis.lost);
  expect(by.lost.statuses.reduce((s: number, r: any) => s + r.count, 0), "lost reasons add up to lost").toBe(kpis.lost);
  expect(o.rates.find((r: any) => r.key === "win").value).toBeCloseTo(kpis.conversionRate, 5);

  const lost = await (await api.get("leads?stage=LOST&pageSize=1")).json();
  expect(lost.meta.total, "stage filter = lost bucket").toBe(kpis.lost);

  await uiLogin(page, ROLES.owner);
  await page.goto("/leads");
  await expect(page.getByText("Lead Outcomes")).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Lost" }).filter({ hasText: "No Requirement" }).getByRole("button", { name: "View" }).click();
  await expect(page.locator("select").first()).toHaveValue("stage:LOST");
  await expect.poll(async () => (await page.getByText(/of [\d,]+$/).first().innerText()).replace(/,/g, "")).toContain(`of ${kpis.lost}`);
});

test("source performance: counts match the leads list and the database, ratings follow the rules", async ({ page }) => {
  const api = await apiAs(ROLES.owner);
  const [perf, kpis] = await Promise.all([(await api.get("leads/source-performance")).json(), (await api.get("leads/kpis")).json()]);
  const rows: any[] = perf.sources;

  for (const r of rows) {
    expect(r.worked, r.source).toBeLessThanOrEqual(r.leads);
    expect(r.won + r.lost, r.source).toBeLessThanOrEqual(r.leads);
    expect(r.won, r.source).toBeLessThanOrEqual(kpis.won);
    if (r.leads < perf.minLeads) expect(r.rating, `${r.source} is too small to judge`).toBe("low_volume");
    if (r.leads >= perf.minLeads && r.contactRate < 50) expect(r.rating, `${r.source} is mostly unworked`).toBe("unworked");
    expect(["strong", "average", "weak", "unworked", "low_volume"]).toContain(r.rating);
  }
  // Every lead is in at least one row (a lead with several sources counts under each).
  expect(rows.reduce((s, r) => s + r.leads, 0)).toBeGreaterThanOrEqual(kpis.totalLeads);
  const noSource = rows.find((r) => r.sourceId === null);
  expect(noSource?.leads ?? 0, "leads with no source").toBe(
    sql(`select count(*) from "Lead" l where l."organizationId"=${ORG} and l."deletedAt" is null and not exists (select 1 from "LeadSourceOnLead" x where x."leadId"=l.id)`),
  );

  // Each source's lead count == the leads list filtered to that source.
  for (const r of rows.filter((x) => x.sourceId).slice(0, 4)) {
    const list = await (await api.get(`leads?sourceId=${r.sourceId}&pageSize=1`)).json();
    expect(list.meta.total, r.source).toBe(r.leads);
  }

  await uiLogin(page, ROLES.owner);
  await page.goto("/leads");
  await expect(page.getByText("Source Performance")).toBeVisible();
  const ref = rows.find((r) => r.source === "Reference") ?? rows.find((r) => r.sourceId && r.leads > 50);
  await page.getByRole("row").filter({ hasText: ref.source }).getByRole("button", { name: "View" }).click();
  await expect(page.getByLabel("Filter by source")).toHaveValue(ref.sourceId);
  await expect.poll(async () => (await page.getByText(/of [\d,]+$/).first().innerText()).replace(/,/g, "")).toContain(`of ${ref.leads}`);
});
