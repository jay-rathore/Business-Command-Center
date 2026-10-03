import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiAs, ROLES, TEST_LEAD } from "./helpers";

// Features that call outside services (AI, ad platforms, CRM, WooCommerce). Slow-ish and may cost
// a few AI tokens. Sync "run" endpoints re-pull data into the DB (idempotent upserts).
test.setTimeout(180_000);

let api: APIRequestContext;
let leadId: string;
test.beforeAll(async () => {
  api = await apiAs(ROLES.owner);
  const list = (await (await api.get("leads?q=Testing&pageSize=100")).json()).data;
  leadId = list.find((l: any) => l.name === TEST_LEAD.name && l.phone === TEST_LEAD.phone).id;
});

test("integration connections never leak secrets", async () => {
  // Check WHICH FIELDS come back, not the words in the values: error messages legitimately contain
  // words like "token" (e.g. a failing oauth2.googleapis.com/token URL) without being a secret.
  const conns = await (await api.get("integration-connections")).json();
  expect(conns.length).toBeGreaterThan(0);
  for (const c of conns) {
    expect(Object.keys(c).sort(), c.provider).toEqual(["id", "isActive", "lastSyncError", "lastSyncedAt", "provider", "updatedAt"]);
  }
});

test("integration health: report any connection whose last sync failed", async () => {
  const conns = await (await api.get("integration-connections")).json();
  const failing = conns.filter((c: any) => c.isActive && c.lastSyncError).map((c: any) => `${c.provider}: ${c.lastSyncError}`);
  console.log("FAILING INTEGRATIONS:", failing.length ? failing : "none");
  expect(failing, "an active integration is failing to sync").toEqual([]);
});

const SYNCS: [string, string][] = [
  ["CRM leads", "leads/crm-sync/run"],
  ["WooCommerce products", "products/wc-sync/run"],
  ["Meta Ads", "marketing/meta-ads-sync/run"],
  ["Google Ads", "marketing/google-ads-sync/run"],
  ["Google Analytics", "marketing/google-analytics-sync/run"],
  ["Search Console", "marketing/search-console-sync/run"],
];
test("sync endpoints: manual run is allowed for owner, forbidden for non-managers, and loses no data", async () => {
  const mkt = await apiAs(ROLES.salesExec);
  const before = (await (await api.get("leads/kpis")).json()).totalLeads;
  const productsBefore = (await (await api.get("products/stats/summary")).json()).totalSkus;
  const failed: string[] = [];
  for (const [name, path] of SYNCS) {
    expect((await mkt.post(path)).status(), `${name} as sales exec`).toBe(403);
    const r = await api.post(path);
    console.log(`SYNC ${name} ->`, r.status(), (await r.text()).slice(0, 160));
    // 500 = unhandled crash; a provider failure must surface as a clear 4xx/502 with a reason.
    if (r.status() === 500) failed.push(`${name}: ${r.status()}`);
  }
  expect(failed, "sync endpoints must not 5xx").toEqual([]);
  expect((await (await api.get("leads/kpis")).json()).totalLeads).toBeGreaterThanOrEqual(before);
  expect((await (await api.get("products/stats/summary")).json()).totalSkus).toBeGreaterThanOrEqual(productsBefore);
});

test("Chat AI / Voice AI quotation parsing", async () => {
  expect((await api.post(`leads/${leadId}/quotations/parse`, { data: { text: "hi", mode: "BOGUS" } })).status()).toBe(400);
  for (const mode of ["CHAT_AI", "VOICE_AI"]) {
    const res = await api.post(`leads/${leadId}/quotations/parse`, {
      data: { mode, text: "Quote for Vivek Interiors, Palghar. 20 sheets Walnut Brown HPL at 1800 each and 5 custom cladding panels at 3200 each, standard terms" },
    });
    const body = await res.text();
    console.log(`PARSE ${mode} ->`, res.status(), body.slice(0, 400));
    expect(res.status(), body).toBeLessThan(300);
    const q = JSON.parse(body);
    const items = (q.items ?? q.draft?.items) as any[];
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.map((i) => Number(i.quantity)).sort((a, b) => a - b)).toEqual([5, 20]);
    // A rate stated in the text must win over the catalog unit price (it used to be replaced: 1800 -> 1250).
    expect(items.map((i) => Number(i.unitRate)).sort((a, b) => a - b)).toEqual([1800, 3200]);
  }
});

test("business card scan extracts fields from an image", async ({ page }) => {
  await page.setContent(`<body style="margin:0"><div style="width:700px;height:400px;background:#fff;padding:40px;font:28px Arial">
    <b style="font-size:40px">Ravi Menon</b><br>Director, Menon Interiors Pvt Ltd<br><br>
    Phone: +91 98765 12345<br>Email: ravi@menoninteriors.example<br>12 MG Road, Pune, Maharashtra</div></body>`);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 780, height: 480 } });
  const res = await api.post("leads/business-card/scan", { data: { imageDataUrl: `data:image/png;base64,${png.toString("base64")}` } });
  const body = await res.text();
  console.log("SCAN ->", res.status(), body.slice(0, 500));
  expect(res.status(), body).toBeLessThan(300);
  expect(body).toMatch(/Ravi/i);
  expect(body.replace(/\s/g, "")).toMatch(/98765/);
  expect((await api.post("leads/business-card/scan", { data: { imageDataUrl: "not-an-image" } })).status()).toBe(400);
});

test("traffic intelligence: overview, timeline, AI investigation, event detail", async () => {
  expect((await api.get("marketing/traffic-intelligence/overview")).status()).toBe(200);
  const tl = await (await api.get("marketing/traffic-intelligence/timeline")).json();
  const events = Array.isArray(tl) ? tl : tl.events ?? tl.data ?? [];
  if (events[0]) expect((await api.get(`marketing/traffic-intelligence/events/${events[0].id}`)).status()).toBe(200);
  const inv = await api.post("marketing/traffic-intelligence/investigate", { data: { question: "Why did traffic change recently?" } });
  console.log("INVESTIGATE ->", inv.status(), (await inv.text()).slice(0, 300));
  expect(inv.status()).toBeLessThan(500);
  expect((await api.post("marketing/traffic-intelligence/investigate", { data: { question: "x".repeat(501) } })).status()).toBe(400);
});

test("dashboard AI summary returns text", async () => {
  const res = await api.get("dashboard/ai-summary");
  console.log("AI SUMMARY ->", res.status(), (await res.text()).slice(0, 300));
  expect(res.status()).toBe(200);
});
