import { test, expect } from "@playwright/test";
import { apiAs, ROLES } from "./helpers";

// Every read endpoint, as owner, must answer 200 — and list endpoints' first row must open in detail.
const LISTS = [
  "dashboard/summary", "dashboard/business-health", "dashboard/attention", "dashboard/contributors", "dashboard/ai-summary",
  "sales/overview", "sales/revenue-trend", "sales/breakdown", "sales/table",
  "leads", "leads/kpis", "leads/funnel", "leads/sources", "leads/statuses", "leads/types", "leads/executives", "leads/duplicates",
  "quotations", "quotations/products",
  "marketing", "marketing/kpis", "marketing/channel-breakdown",
  "marketing/traffic-intelligence/overview", "marketing/traffic-intelligence/timeline", "marketing/traffic-intelligence/proactive-insights",
  "sales-team", "sales-team/kpis", "sales-team/leaderboard", "sales-team/follow-up-risk",
  "dealers", "dealers/kpis", "dealers/leaderboard", "dealers/risk-alerts",
  "architects", "architects/kpis", "architects/leaderboard", "architects/recent-referrals",
  "builders", "builders/kpis", "builders/leaderboard", "builders/recent-referrals",
  "projects", "projects/kanban", "projects/kpis", "projects/stage-distribution", "projects/stuck", "projects/closing-soon",
  "customers", "customers/kpis", "customers/leaderboard", "customers/at-risk",
  "products", "products/categories", "products/shades", "products/stats/summary", "products/stats/by-category", "products/stats/needs-attention",
  "notifications", "notifications/unread-count", "sales-targets", "company-profiles", "integration-connections",
  "platform-admin/organizations", "health",
];
const DETAIL = ["leads", "quotations", "marketing", "dealers", "architects", "builders", "projects", "customers", "products"];

test("every read endpoint returns 200 for owner", async () => {
  const api = await apiAs(ROLES.owner);
  const bad: string[] = [];
  for (const p of LISTS) {
    const r = await api.get(p);
    if (r.status() !== 200) bad.push(`${r.status()} ${p}`);
  }
  expect(bad).toEqual([]);
});

for (const base of DETAIL) {
  test(`detail endpoint works: ${base}/:id`, async () => {
    const api = await apiAs(ROLES.owner);
    const body = await (await api.get(`${base}?pageSize=1`)).json();
    const first = (Array.isArray(body) ? body : body.data)[0];
    test.skip(!first, `no ${base} rows`);
    expect((await api.get(`${base}/${first.id}`)).status()).toBe(200);
    expect((await api.get(`${base}/nonexistent-id`)).status()).toBe(404);
  });
}

test("recompute endpoints respond without 5xx", async () => {
  const api = await apiAs(ROLES.owner);
  const d = (await (await api.get("dealers?pageSize=1")).json()).data[0];
  const c = (await (await api.get("customers?pageSize=1")).json()).data[0];
  expect((await api.post(`dealers/${d.id}/recompute-score`)).status()).toBeLessThan(300);
  expect((await api.post(`customers/${c.id}/recompute-metrics`)).status()).toBeLessThan(300);
});
