import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiAs, ROLES, TEST_LEAD } from "./helpers";
// The money maths is shared by the server and the dialog preview; test it directly.
import { amountInWords, computeTotals, gstSplit } from "../../../packages/shared/src/invoice-math";

test.describe("invoice maths", () => {
  test("amount in words uses Indian numbering", () => {
    expect(amountInWords(0)).toBe("Rupees Zero Only");
    expect(amountInWords(17700)).toBe("Rupees Seventeen Thousand Seven Hundred Only");
    expect(amountInWords(123456.5)).toBe("Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only");
    expect(amountInWords(12345678)).toBe("Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only");
    expect(amountInWords(1000000)).toBe("Rupees Ten Lakh Only");
    expect(amountInWords(99)).toBe("Rupees Ninety Nine Only");
  });

  test("GST: same state splits CGST/SGST, other state is IGST", () => {
    expect(gstSplit(2520, "Maharashtra", " maharashtra ")).toEqual({ isIntraState: true, cgst: 1260, sgst: 1260, igst: 0 });
    expect(gstSplit(2520, "Maharashtra", "Karnataka")).toEqual({ isIntraState: false, cgst: 0, sgst: 0, igst: 2520 });
    const odd = gstSplit(0.03, "A", "A");
    expect(odd.cgst + odd.sgst).toBeCloseTo(0.03, 2); // an odd paisa is never lost
  });

  test("totals round to the rupee and the balance is what remains", () => {
    const t = computeTotals([{ lineAmount: 14000, lineTax: 2520 }], 50);
    expect(t).toMatchObject({ subtotal: 14000, gstAmount: 2520, totalAmount: 16520, roundoff: 0, advanceAmount: 8260, beforeDispatchAmount: 8260 });
    const r = computeTotals([{ lineAmount: 100.4, lineTax: 18.07 }], 30);
    expect(r).toMatchObject({ totalAmount: 118, roundoff: -0.47 });
    expect(r.advanceAmount + r.beforeDispatchAmount).toBe(118);
  });
});

test.describe.configure({ mode: "serial" });

const DUE = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10);
let api: APIRequestContext;
let leadId: string;
let profileId: string;

async function newQuotation(state = "Maharashtra", rate = 1500) {
  const res = await api.post(`leads/${leadId}/quotations`, {
    data: {
      companyProfileId: profileId,
      customer: { name: "Testing", address: "1 Test Rd", city: "Mumbai", state, contact: TEST_LEAD.phone },
      items: [{ itemName: "E2E HPL Sheet", quantity: 10, unitRate: rate, taxPercent: 18 }],
      advancePercent: 50,
      beforeDispatchPercent: 50,
      termsAndConditions: "e2e",
      validUntil: new Date(Date.now() + 7 * 864e5).toISOString(),
      inputMode: "MANUAL",
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

const invoiceBody = (q: any, rate: number, extra: Record<string, unknown> = {}) => ({
  items: [{ quotationItemId: q.items[0].id, itemName: q.items[0].itemName, quantity: q.items[0].quantity, unitRate: rate, taxPercent: 18 }],
  advancePercent: 50,
  beforeDispatchPercent: 50,
  dueDate: DUE,
  ...extra,
});

test.beforeAll(async () => {
  api = await apiAs(ROLES.owner);
  const leads = (await (await api.get("leads?q=Testing&pageSize=100")).json()).data;
  leadId = leads.find((l: any) => l.name === TEST_LEAD.name && l.phone === TEST_LEAD.phone).id;
  profileId = (await (await api.get("company-profiles")).json())[0].id;
});

let negotiated: any; // the quotation that gets a negotiated invoice
let invoice: any;

test("negotiated invoice: new price, revised quotation, original untouched", async () => {
  negotiated = await newQuotation();
  expect(negotiated.invoice).toBeNull();
  const originalPdf = await (await api.get(`quotations/${negotiated.id}/pdf`)).body();

  const res = await api.post(`quotations/${negotiated.id}/invoice`, { data: invoiceBody(negotiated, 1400, { negotiationNote: "Customer asked for a better rate on volume" }) });
  expect(res.status(), await res.text()).toBe(201);
  invoice = await res.json();

  expect(invoice.invoiceCode).toMatch(/^INV-\d{4}-\d{4}$/);
  expect(invoice).toMatchObject({ isNegotiated: true, subtotal: 14000, gstAmount: 2520, totalAmount: 16520, quotedTotalAmount: 17700, locked: false });
  expect(invoice.revisedQuotationCode).toBe(`${negotiated.quotationCode}-R1`);
  expect(invoice.items[0]).toMatchObject({ unitRate: 1400, quotedUnitRate: 1500, quotationItemId: negotiated.items[0].id });
  // Maharashtra seller + Maharashtra buyer -> CGST + SGST
  expect(invoice).toMatchObject({ isIntraState: true, cgst: 1260, sgst: 1260, igst: 0 });

  // both PDFs are real PDFs; the updated quotation is a different file from the original, which is unchanged
  const inv = await api.get(`invoices/${invoice.id}/pdf`);
  const upd = await api.get(`invoices/${invoice.id}/quotation-pdf`);
  expect([inv.status(), upd.status()]).toEqual([200, 200]);
  expect((await inv.body()).subarray(0, 4).toString()).toBe("%PDF");
  const updated = await upd.body();
  expect(updated.subarray(0, 4).toString()).toBe("%PDF");
  expect(updated.equals(originalPdf)).toBe(false);
  expect((await (await api.get(`quotations/${negotiated.id}/pdf`)).body()).equals(originalPdf)).toBe(true);

  // the quotation now points at its invoice
  const q = await (await api.get(`quotations/${negotiated.id}`)).json();
  expect(q.invoice).toMatchObject({ id: invoice.id, invoiceCode: invoice.invoiceCode, totalAmount: 16520 });
  expect(q.totalAmount, "the quotation itself is never edited").toBe(17700);
});

test("one invoice per quotation", async () => {
  const dup = await api.post(`quotations/${negotiated.id}/invoice`, { data: invoiceBody(negotiated, 1400) });
  expect(dup.status()).toBe(409);
  expect(await dup.text()).toContain(invoice.invoiceCode);
});

test("validation", async () => {
  const q = await newQuotation();
  const post = (data: any) => api.post(`quotations/${q.id}/invoice`, { data });
  expect((await post({ ...invoiceBody(q, 1400), items: [] })).status(), "empty items").toBe(400);
  expect((await post(invoiceBody(q, -5))).status(), "negative rate").toBe(400);
  expect((await post({ ...invoiceBody(q, 1400), dueDate: "not-a-date" })).status(), "bad date").toBe(400);
  expect((await post({ ...invoiceBody(q, 1400), advancePercent: 150 })).status(), "advance > 100").toBe(400);
  const foreign = { ...invoiceBody(q, 1400), items: [{ ...invoiceBody(q, 1400).items[0], quotationItemId: negotiated.items[0].id }] };
  expect((await post(foreign)).status(), "line from another quotation").toBe(400);
  const twice = { ...invoiceBody(q, 1400), items: [invoiceBody(q, 1400).items[0], invoiceBody(q, 1400).items[0]] };
  expect((await post(twice)).status(), "same line twice").toBe(400);
  expect((await api.post("quotations/does-not-exist/invoice", { data: invoiceBody(q, 1400) })).status()).toBe(404);
});

test("unchanged prices: no revised quotation, the original travels with the invoice", async () => {
  const q = await newQuotation();
  const original = await (await api.get(`quotations/${q.id}/pdf`)).body();
  const inv = await (await api.post(`quotations/${q.id}/invoice`, { data: invoiceBody(q, 1500) })).json();
  expect(inv).toMatchObject({ isNegotiated: false, revisedQuotationCode: null, totalAmount: 17700 });
  expect((await (await api.get(`invoices/${inv.id}/quotation-pdf`)).body()).equals(original)).toBe(true);
});

test("a line added during negotiation counts as negotiated and has no quoted rate", async () => {
  const q = await newQuotation();
  const body = invoiceBody(q, 1500);
  body.items.push({ quotationItemId: null as any, itemName: "Edge banding (agreed on call)", quantity: 4, unitRate: 250, taxPercent: 18 });
  const inv = await (await api.post(`quotations/${q.id}/invoice`, { data: body })).json();
  expect(inv.isNegotiated).toBe(true);
  expect(inv.items[1]).toMatchObject({ quotedUnitRate: null, quotationItemId: null, lineAmount: 1000 });
  expect(inv.totalAmount).toBe(Math.round(15000 * 1.18 + 1000 * 1.18));
});

test("a buyer in another state is billed IGST", async () => {
  const q = await newQuotation("Karnataka");
  const inv = await (await api.post(`quotations/${q.id}/invoice`, { data: invoiceBody(q, 1500) })).json();
  expect(inv).toMatchObject({ isIntraState: false, cgst: 0, sgst: 0, igst: 2700 });
});

test("a draft invoice can be re-negotiated; the number stays", async () => {
  const res = await api.patch(`invoices/${invoice.id}`, { data: invoiceBody(negotiated, 1350, { negotiationNote: "Second round" }) });
  expect(res.status(), await res.text()).toBe(200);
  const edited = await res.json();
  expect(edited.invoiceCode).toBe(invoice.invoiceCode);
  expect(edited).toMatchObject({ totalAmount: Math.round(13500 * 1.18), revisedQuotationCode: invoice.revisedQuotationCode, negotiationNote: "Second round" });
  expect(edited.items).toHaveLength(1);
  expect((await api.patch("invoices/nope", { data: invoiceBody(negotiated, 1350) })).status()).toBe(404);
  invoice = edited;
});

test("list and search", async () => {
  const list = await (await api.get(`invoices?q=${invoice.invoiceCode}`)).json();
  expect(list.data.map((i: any) => i.id)).toContain(invoice.id);
  expect(list.data[0]).toMatchObject({ quotationCode: negotiated.quotationCode, leadName: "Testing" });
  const all = await (await api.get("invoices?pageSize=5&sortBy=totalAmount&sortDir=desc")).json();
  expect(all.meta.total).toBeGreaterThanOrEqual(4);
});

test("permissions: read-only roles can look, not create; others can't see invoices at all", async () => {
  const marketing = await apiAs(ROLES.marketing); // leads:read only
  expect((await marketing.get("invoices")).status()).toBe(200);
  expect((await marketing.post(`quotations/${negotiated.id}/invoice`, { data: invoiceBody(negotiated, 1400) })).status()).toBe(403);
  expect((await marketing.patch(`invoices/${invoice.id}`, { data: invoiceBody(negotiated, 1400) })).status()).toBe(403);
  expect((await marketing.post(`invoices/${invoice.id}/send-email`, { data: {} })).status()).toBe(403);
  const dealer = await apiAs(ROLES.dealerManager); // no leads access
  expect((await dealer.get("invoices")).status()).toBe(403);
  expect((await dealer.get(`invoices/${invoice.id}/pdf`)).status()).toBe(403);
  const anon = await (await import("@playwright/test")).request.newContext({ baseURL: "http://localhost:4000/api/" });
  expect((await anon.get("invoices")).status()).toBe(401);
});

test("whatsapp send is a handled failure (not configured)", async () => {
  const res = await api.post(`invoices/${invoice.id}/send-whatsapp`, { data: { phone: TEST_LEAD.phone } });
  expect(res.status()).toBeLessThan(500);
});

test("emailing sends the invoice AND the updated quotation, then locks the invoice", async () => {
  test.setTimeout(120_000);
  expect((await api.post(`invoices/${invoice.id}/send-email`, { data: { email: "not-an-email" } })).status()).toBe(400);
  const res = await api.post(`invoices/${invoice.id}/send-email`, { data: { email: TEST_LEAD.email } });
  expect(res.status(), await res.text()).toBe(201);
  const sent = await res.json();
  expect(sent.attachmentsSent).toEqual([`${invoice.invoiceCode}.pdf`, `${invoice.revisedQuotationCode}.pdf`]);
  expect(sent).toMatchObject({ emailStatus: "SENT", emailSentTo: TEST_LEAD.email, locked: true });

  const edit = await api.patch(`invoices/${invoice.id}`, { data: invoiceBody(negotiated, 1200) });
  expect(edit.status(), "sent invoices are locked").toBe(409);
  expect((await (await api.get(`invoices/${invoice.id}`)).json()).totalAmount).toBe(invoice.totalAmount);
});
