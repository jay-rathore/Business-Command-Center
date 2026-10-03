import { test, expect } from "@playwright/test";
import { apiAs, uiLogin, ROLES, TEST_LEAD } from "./helpers";

async function freshQuotation() {
  const api = await apiAs(ROLES.owner);
  const lead = (await (await api.get("leads?q=Testing&pageSize=100")).json()).data.find((l: any) => l.name === TEST_LEAD.name && l.phone === TEST_LEAD.phone);
  const profile = (await (await api.get("company-profiles")).json())[0];
  const res = await api.post(`leads/${lead.id}/quotations`, {
    data: {
      companyProfileId: profile.id,
      customer: { name: "Testing", address: "1 Test Rd", city: "Mumbai", state: "Maharashtra", contact: TEST_LEAD.phone },
      items: [
        { itemName: "UI E2E Sheet", quantity: 10, unitRate: 1500, taxPercent: 18 },
        { itemName: "UI E2E Edge Band", quantity: 5, unitRate: 200, taxPercent: 18 },
      ],
      advancePercent: 50,
      beforeDispatchPercent: 50,
      termsAndConditions: "e2e",
      validUntil: new Date(Date.now() + 7 * 864e5).toISOString(),
      inputMode: "MANUAL",
    },
  });
  return res.json();
}

test("create an invoice from a quotation at a negotiated price, then re-negotiate it", async ({ page }) => {
  const q = await freshQuotation(); // 10 x 1500 + 5 x 200 = 16,000 + 18% = 18,880
  await uiLogin(page, ROLES.owner);
  await page.goto("/quotations");
  await page.getByPlaceholder(/search quotation code/i).fill(q.quotationCode);
  await page.locator("tbody tr", { hasText: q.quotationCode }).click();

  // the quotation drawer offers the invoice
  const section = page.getByTestId("invoice-section");
  await expect(section).toContainText("Customer confirmed");
  await section.getByRole("button", { name: "Create invoice" }).click();

  const dialog = page.getByRole("dialog").filter({ hasText: `Create invoice from ${q.quotationCode}` });
  await expect(dialog.getByLabel("Agreed rate 1")).toHaveValue("1500");
  await expect(dialog.getByTestId("invoice-total")).toHaveText(/18,880\.00/);
  await expect(dialog.getByTestId("invoice-diff")).toHaveCount(0); // nothing negotiated yet

  // negotiate: 1500 -> 1400 on the sheets
  await dialog.getByLabel("Agreed rate 1").fill("1400");
  await expect(dialog.getByTestId("invoice-total")).toHaveText(/17,700\.00/); // 14,000 + 1,000 = 15,000 + 18%
  await expect(dialog.getByTestId("invoice-diff")).toContainText("Agreed discount");
  await expect(dialog.getByTestId("invoice-diff")).toContainText("1,180.00");
  await dialog.getByLabel(/Negotiation note/).fill("Volume discount agreed on call");

  // client-side validation
  await dialog.getByLabel("Quantity 2").fill("0");
  await dialog.getByRole("button", { name: "Create invoice" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Line 2");
  await dialog.getByLabel("Quantity 2").fill("5");

  await dialog.getByRole("button", { name: "Create invoice" }).click();

  // the invoice drawer opens with the negotiation summary and both documents
  const summary = page.getByTestId("negotiation-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("18,880.00");
  await expect(summary).toContainText("17,700.00");
  await expect(summary).toContainText("Volume discount agreed on call");
  await expect(page.locator('iframe[title="Invoice PDF preview"]')).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`Updated quotation ${q.quotationCode}-R1`) }).click();
  await expect(page.locator('iframe[title="Updated quotation PDF preview"]')).toBeVisible();
  await expect(page.getByText(/both documents together/i)).toBeVisible();

  // re-negotiate while it is still a draft
  await page.getByRole("button", { name: "Edit / re-negotiate" }).click();
  const edit = page.getByRole("dialog").filter({ hasText: "Edit INV-" });
  await expect(edit.getByLabel("Agreed rate 1")).toHaveValue("1400");
  await edit.getByLabel("Agreed rate 1").fill("1300");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Invoice updated — both PDFs were regenerated.")).toBeVisible();
  await expect(summary).toContainText("16,520.00"); // 13,000 + 1,000 = 14,000 + 18%

  // it shows up on the Invoices tab and the Quotations table points at it
  const api = await apiAs(ROLES.owner);
  const inv = (await (await api.get(`quotations/${q.id}`)).json()).invoice;
  expect(inv.invoiceCode).toMatch(/^INV-/);
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Invoices" }).click();
  await page.getByPlaceholder(/search invoice or quotation code/i).fill(inv.invoiceCode);
  const row = page.locator("tbody tr", { hasText: inv.invoiceCode });
  await expect(row).toContainText("Negotiated");
  await expect(row).toContainText("16,520");
  await page.getByRole("tab", { name: "Quotations" }).click();
  await page.getByPlaceholder(/search quotation code/i).fill(q.quotationCode);
  await expect(page.locator("tbody tr", { hasText: q.quotationCode })).toContainText(inv.invoiceCode);
});

test("a quotation that already has an invoice offers to open it instead", async ({ page }) => {
  const api = await apiAs(ROLES.owner);
  const q = await freshQuotation();
  const body = { items: q.items.map((i: any) => ({ quotationItemId: i.id, itemName: i.itemName, quantity: i.quantity, unitRate: i.unitRate, taxPercent: 18 })), advancePercent: 50, beforeDispatchPercent: 50, dueDate: new Date(Date.now() + 864e5 * 10).toISOString().slice(0, 10) };
  const inv = await (await api.post(`quotations/${q.id}/invoice`, { data: body })).json();
  expect(inv.isNegotiated).toBe(false);

  await uiLogin(page, ROLES.owner);
  await page.goto("/quotations");
  await page.getByPlaceholder(/search quotation code/i).fill(q.quotationCode);
  await page.locator("tbody tr", { hasText: q.quotationCode }).click();
  const section = page.getByTestId("invoice-section");
  await expect(section).toContainText(inv.invoiceCode);
  await expect(section.getByRole("button", { name: "Create invoice" })).toHaveCount(0);
  await section.getByRole("button", { name: "Open invoice" }).click();
  await expect(page.getByText("As quoted").first()).toBeVisible();
  await expect(page.getByTestId("negotiation-summary")).toHaveCount(0); // nothing to summarise
  await expect(page.getByRole("button", { name: /^Quotation PI-/ })).toBeVisible(); // the original travels with it
});

test("read-only role can see an invoice but gets no create / edit / send actions", async ({ page }) => {
  const api = await apiAs(ROLES.owner);
  const q = await freshQuotation();
  const noInvoice = page; // marketing has leads:read only
  await uiLogin(noInvoice, ROLES.marketing);
  await page.goto("/quotations");
  await page.getByPlaceholder(/search quotation code/i).fill(q.quotationCode);
  await page.locator("tbody tr", { hasText: q.quotationCode }).click();
  await expect(page.getByTestId("invoice-section")).toContainText("No invoice has been raised");
  await expect(page.getByRole("button", { name: "Create invoice" })).toHaveCount(0);

  const body = { items: q.items.map((i: any) => ({ quotationItemId: i.id, itemName: i.itemName, quantity: i.quantity, unitRate: i.unitRate - 100, taxPercent: 18 })), advancePercent: 50, beforeDispatchPercent: 50, dueDate: new Date(Date.now() + 864e5 * 10).toISOString().slice(0, 10) };
  const inv = await (await api.post(`quotations/${q.id}/invoice`, { data: body })).json();
  await page.reload();
  await page.getByPlaceholder(/search quotation code/i).fill(q.quotationCode);
  await page.locator("tbody tr", { hasText: q.quotationCode }).click();
  await page.getByTestId("invoice-section").getByRole("button", { name: "Open invoice" }).click();
  await expect(page.getByTestId("negotiation-summary")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit / re-negotiate" })).toHaveCount(0);
  await expect(page.getByLabel("Email address")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Download invoice" })).toBeVisible();
  expect(inv.isNegotiated).toBe(true);
});
