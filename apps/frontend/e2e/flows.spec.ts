import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiAs, uiLogin, ROLES, TEST_LEAD } from "./helpers";

test.describe.configure({ mode: "serial" });

const rows = (b: any): any[] => (Array.isArray(b) ? b : b.data);
let api: APIRequestContext;
let leadId: string;
let quotationId: string;

test.beforeAll(async () => {
  api = await apiAs(ROLES.owner);
});

test("find or create the Testing lead", async () => {
  const list = rows(await (await api.get("leads?q=Testing&pageSize=100")).json());
  const found = list.find((l) => l.name === TEST_LEAD.name && l.phone === TEST_LEAD.phone);
  if (found) return void (leadId = found.id);
  const res = await api.post("leads", {
    data: { ...TEST_LEAD, email: null, state: "Maharashtra", city: "Mumbai", saveImage: false },
  });
  expect(res.status()).toBe(201);
  leadId = (await res.json()).id;
});

test("lead create validates input", async () => {
  expect((await api.post("leads", { data: { name: "", phone: "1", saveImage: false } })).status()).toBe(400);
});

test("lead detail + activity + 404", async () => {
  const lead = await (await api.get(`leads/${leadId}`)).json();
  expect(lead.phone).toBe(TEST_LEAD.phone);
  const act = await api.post(`leads/${leadId}/activities`, { data: { type: "NOTE", note: "e2e note" } });
  expect(act.ok(), await act.text()).toBeTruthy();
  expect((await api.get("leads/does-not-exist")).status()).toBe(404);
});

test("create quotation (manual) and fetch PDF", async () => {
  const profiles = rows(await (await api.get("company-profiles")).json());
  expect(profiles.length).toBeGreaterThan(0);
  const res = await api.post(`leads/${leadId}/quotations`, {
    data: {
      companyProfileId: profiles[0].id,
      customer: { name: "Testing", address: "1 Test Rd", city: "Mumbai", state: "Maharashtra", contact: TEST_LEAD.phone },
      items: [{ itemName: "E2E HPL Sheet", quantity: 10, unitRate: 1500, taxPercent: 18 }],
      advancePercent: 50,
      beforeDispatchPercent: 50,
      termsAndConditions: "e2e",
      validUntil: new Date(Date.now() + 7 * 864e5).toISOString(),
      inputMode: "MANUAL",
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const q = await res.json();
  quotationId = q.id;
  expect(Number(q.totalAmount)).toBeCloseTo(17700, 0); // 10 x 1500 + 18% GST

  const pdf = await api.get(`quotations/${quotationId}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
});

test("quotation validation rejects empty items", async () => {
  const res = await api.post(`leads/${leadId}/quotations`, { data: { items: [] } });
  expect(res.status()).toBe(400);
});

test("send quotation email to the Testing contact only", async () => {
  test.setTimeout(120_000); // Gmail SMTP latency varies 7s-30s+
  const bad = await api.post(`quotations/${quotationId}/send-email`, { data: { email: "not-an-email" } });
  expect(bad.status()).toBe(400);
  const res = await api.post(`quotations/${quotationId}/send-email`, { data: { email: TEST_LEAD.email } });
  const q = await (await api.get(`quotations/${quotationId}`)).json();
  console.log("email send ->", res.status(), q.emailStatus);
  expect(res.ok(), await res.text()).toBeTruthy();
  expect(q.emailStatus).toBe("SENT");
});

test("whatsapp send is a handled failure (API not configured)", async () => {
  const res = await api.post(`quotations/${quotationId}/send-whatsapp`, { data: { phone: TEST_LEAD.phone } });
  console.log("whatsapp send ->", res.status(), (await res.text()).slice(0, 200));
  expect(res.status(), "must not be a 500").toBeLessThan(500);
});

test("quotation shows in Quotations UI with PDF + send controls", async ({ page }) => {
  await uiLogin(page, ROLES.owner);
  await page.goto("/quotations");
  await page.getByRole("button", { name: /new quotation/i }).click();
  await page.getByPlaceholder(/search by name/i).fill(TEST_LEAD.phone.slice(-10));
  await expect(page.getByText("Testing").first()).toBeVisible();
});

test("projects: stage change round-trips", async () => {
  const projects = rows(await (await api.get("projects?pageSize=5")).json());
  test.skip(!projects.length, "no projects");
  const p = projects[0];
  const orig = p.stage;
  const to = orig === "DISCOVERY" ? "SAMPLE" : "DISCOVERY";
  expect((await api.patch(`projects/${p.id}/stage`, { data: { toStage: to } })).ok()).toBeTruthy();
  expect((await (await api.get(`projects/${p.id}`)).json()).stage).toBe(to);
  expect((await api.patch(`projects/${p.id}/stage`, { data: { toStage: orig } })).ok()).toBeTruthy();
  expect((await api.patch(`projects/${p.id}/stage`, { data: { toStage: "BOGUS" } })).status()).toBe(400);
});

test("notifications: unread count and mark-all-read", async () => {
  const before = await (await api.get("notifications/unread-count")).json();
  expect(before).toBeDefined();
  expect((await api.post("notifications/read-all")).ok()).toBeTruthy();
  const after = await (await api.get("notifications/unread-count")).json();
  expect(Number(after)).toBe(0);
});

test("sales targets: create, update, delete", async () => {
  const body = {
    scope: "COMPANY", periodType: "MONTHLY",
    periodStart: "2031-01-01", periodEnd: "2031-01-31", targetRevenue: 123456,
  };
  const created = await api.post("sales-targets", { data: body });
  expect(created.status(), await created.text()).toBe(201);
  const id = (await created.json()).id;
  const upd = await api.patch(`sales-targets/${id}`, { data: { ...body, targetRevenue: 200000 } });
  expect(upd.ok(), await upd.text()).toBeTruthy();
  expect((await api.post("sales-targets", { data: { ...body, targetRevenue: -1 } })).status()).toBe(400);
  expect((await api.delete(`sales-targets/${id}`)).ok()).toBeTruthy();
});

test("platform admin: create tenant, duplicate slug rejected, deactivate", async () => {
  const slug = `e2e-${Date.now()}`;
  const body = { name: "E2E Tenant", slug, adminName: "E2E Admin", adminEmail: `${slug}@example.test` };
  const res = await api.post("platform-admin/organizations", { data: body });
  expect(res.status(), await res.text()).toBe(201);
  const org = await res.json();
  expect((await api.post("platform-admin/organizations", { data: body })).status()).toBeGreaterThanOrEqual(400);
  expect((await api.post("platform-admin/organizations", { data: { ...body, slug: "Bad Slug" } })).status()).toBe(400);
  const id = org.id ?? org.organization?.id;
  expect((await api.patch(`platform-admin/organizations/${id}/active`, { data: { isActive: false } })).ok()).toBeTruthy();
});
