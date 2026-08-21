import { CompanyProfileOption, LeadListItem, QuotationDraft, QuotationItemInput } from "@hpl/shared";

export interface FormItemRow extends QuotationItemInput {
  key: string;
}

export interface QuotationFormState {
  companyProfileId: string;
  name: string;
  company: string;
  address: string;
  city: string;
  state: string;
  gstin: string;
  contact: string;
  items: FormItemRow[];
  advancePercent: number;
  beforeDispatchPercent: number;
  termsAndConditions: string;
  validUntil: string; // yyyy-mm-dd, for <input type="date">
}

let rowKeySeq = 0;
export function newItemRow(partial?: Partial<QuotationItemInput>): FormItemRow {
  rowKeySeq += 1;
  return {
    key: `row-${rowKeySeq}`,
    productId: partial?.productId ?? null,
    itemName: partial?.itemName ?? "",
    hsnCode: partial?.hsnCode ?? "",
    quantity: partial?.quantity ?? 1,
    unitRate: partial?.unitRate ?? null,
    taxPercent: partial?.taxPercent ?? 18,
  };
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildDefaultFormState(lead: LeadListItem, profile: CompanyProfileOption | undefined): QuotationFormState {
  return {
    companyProfileId: profile?.id ?? "",
    name: lead.name,
    company: lead.company ?? "",
    address: "",
    city: lead.city,
    state: lead.state,
    gstin: "",
    contact: lead.phone,
    items: [newItemRow()],
    advancePercent: profile?.defaultAdvancePercent ?? 50,
    beforeDispatchPercent: profile?.defaultBeforeDispatchPercent ?? 50,
    termsAndConditions: profile?.defaultTermsAndConditions ?? "",
    validUntil: addDays(profile?.validityDays ?? 30),
  };
}

export function applyDraftToFormState(base: QuotationFormState, draft: QuotationDraft): QuotationFormState {
  return {
    ...base,
    name: draft.customer.name || base.name,
    company: draft.customer.company ?? base.company,
    address: draft.customer.address || base.address,
    city: draft.customer.city || base.city,
    state: draft.customer.state || base.state,
    gstin: draft.customer.gstin ?? base.gstin,
    contact: draft.customer.contact || base.contact,
    items: draft.items.length > 0 ? draft.items.map((item) => newItemRow(item)) : base.items,
    advancePercent: draft.advancePercent ?? base.advancePercent,
    beforeDispatchPercent: draft.beforeDispatchPercent ?? base.beforeDispatchPercent,
  };
}

export interface ComputedTotals {
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  advanceAmount: number;
  beforeDispatchAmount: number;
}

/** Client-side mirror of the server's authoritative calc (quotations.service.ts) — for live
 * preview only; the server always recomputes from scratch on create. */
export function computeTotals(items: FormItemRow[], advancePercent: number, beforeDispatchPercent: number): ComputedTotals {
  let subtotal = 0;
  let gstAmount = 0;
  for (const item of items) {
    const rate = item.unitRate ?? 0;
    const lineAmount = item.quantity * rate;
    const lineTax = (lineAmount * item.taxPercent) / 100;
    subtotal += lineAmount;
    gstAmount += lineTax;
  }
  const totalAmount = Math.round(subtotal + gstAmount);
  const advanceAmount = Math.round((totalAmount * advancePercent) / 100);
  const beforeDispatchAmount = totalAmount - advanceAmount;
  void beforeDispatchPercent;
  return { subtotal, gstAmount, totalAmount, advanceAmount, beforeDispatchAmount };
}

export function formStateIsReadyToSubmit(state: QuotationFormState): boolean {
  if (!state.companyProfileId) return false;
  if (!state.name.trim() || !state.address.trim() || !state.city.trim() || !state.state.trim() || !state.contact.trim()) return false;
  if (state.items.length === 0) return false;
  return state.items.every((item) => item.itemName.trim() && item.quantity > 0 && item.unitRate !== null && item.unitRate >= 0);
}
