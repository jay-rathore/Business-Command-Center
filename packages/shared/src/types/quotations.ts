import { QuotationEmailStatus, QuotationInputMode, QuotationStatus } from "../enums";

// Non-sensitive subset used by the quotation form's picker — deliberately excludes bank/GSTIN
// details (see company-profiles.service.ts findOptions()) since roles that can create
// quotations don't necessarily have settings:read.
export interface CompanyProfileOption {
  id: string;
  label: string;
  isDefault: boolean;
  defaultAdvancePercent: number;
  defaultBeforeDispatchPercent: number;
  defaultTermsAndConditions: string;
  validityDays: number;
}

export interface CompanyProfile {
  id: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  phone: string;
  email: string | null;
  gstin: string;
  logoDataUrl: string | null;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankSwift: string | null;
  defaultTermsAndConditions: string;
  defaultAdvancePercent: number;
  defaultBeforeDispatchPercent: number;
  validityDays: number;
}

export type UpsertCompanyProfileRequest = Omit<CompanyProfile, "id">;

export interface ProductCatalogOption {
  id: string;
  sku: string;
  name: string;
  categoryName: string;
  shadeName: string | null;
  unitPrice: number;
}

/** Draft/form-state shape — unitRate may be null while the AI couldn't determine a price and
 * the operator hasn't filled it in yet. */
export interface QuotationItemInput {
  productId?: string | null;
  itemName: string;
  hsnCode?: string | null;
  quantity: number;
  unitRate: number | null;
  taxPercent: number;
}

/** Same shape with unitRate required — what actually gets submitted to create a Quotation,
 * once the operator has resolved every line's rate. */
export interface QuotationItemPayload extends Omit<QuotationItemInput, "unitRate"> {
  unitRate: number;
}

export interface QuotationDraftCustomer {
  name: string;
  company: string | null;
  address: string;
  city: string;
  state: string;
  gstin: string | null;
  contact: string;
}

/** Returned by the AI parse endpoint. Never persisted directly — the operator must review
 * and explicitly confirm it (editing the same form Manual mode uses) before it becomes a
 * real Quotation. */
export interface QuotationDraft {
  customer: QuotationDraftCustomer;
  items: QuotationItemInput[];
  advancePercent: number | null;
  beforeDispatchPercent: number | null;
  notes: string | null;
}

export interface ParseQuotationTextRequest {
  text: string;
  mode: typeof QuotationInputMode.CHAT_AI | typeof QuotationInputMode.VOICE_AI;
}

export interface CreateQuotationRequest {
  companyProfileId: string;
  customer: QuotationDraftCustomer;
  items: QuotationItemPayload[];
  advancePercent: number;
  beforeDispatchPercent: number;
  termsAndConditions: string;
  validUntil: string;
  inputMode: QuotationInputMode;
  rawInputText?: string | null;
}

export interface QuotationItemLine {
  srNo: number;
  productId: string | null;
  itemName: string;
  hsnCode: string | null;
  quantity: number;
  unitRate: number;
  taxPercent: number;
  lineAmount: number;
  lineTax: number;
  lineTotal: number;
}

export interface QuotationListItem {
  id: string;
  quotationCode: string;
  leadId: string;
  leadName?: string;
  leadCompany?: string | null;
  status: QuotationStatus;
  inputMode: QuotationInputMode;
  totalAmount: number;
  quotationDate: string;
  validUntil: string;
  sentToPhone: string | null;
  sentAt: string | null;
  emailSentTo: string | null;
  emailSentAt: string | null;
  emailStatus: QuotationEmailStatus | null;
}

export interface QuotationDetail extends QuotationListItem {
  companyProfileId: string;
  customer: QuotationDraftCustomer;
  items: QuotationItemLine[];
  subtotal: number;
  gstAmount: number;
  roundoff: number;
  advancePercent: number;
  beforeDispatchPercent: number;
  advanceAmount: number;
  beforeDispatchAmount: number;
  termsAndConditions: string;
  whatsappMessageId: string | null;
}

export interface SendWhatsAppRequest {
  phone?: string;
}

export interface SendWhatsAppResponse {
  status: QuotationStatus;
  whatsappMessageId: string | null;
  sentToPhone: string;
  sentAt: string;
}

export interface SendEmailRequest {
  email?: string;
}

export interface SendEmailResponse {
  emailStatus: QuotationEmailStatus;
  emailSentTo: string;
  emailSentAt: string;
}
