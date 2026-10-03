import { QuotationEmailStatus, QuotationStatus } from "../enums";
import { QuotationDraftCustomer } from "./quotations";

// An invoice is raised from a quotation once the customer confirms (often after negotiating the price).
// Delivery status reuses the quotation enums: `status` is the WhatsApp side, `emailStatus` the email side.

/** One line of the negotiated invoice as submitted. `quotationItemId` links it to the line it came from
 * (so the original offer stays visible); omit it for a line added during negotiation. */
export interface InvoiceItemPayload {
  quotationItemId?: string | null;
  productId?: string | null;
  itemName: string;
  hsnCode?: string | null;
  quantity: number;
  unitRate: number;
  taxPercent: number;
}

export interface SaveInvoiceRequest {
  items: InvoiceItemPayload[];
  advancePercent: number;
  beforeDispatchPercent: number;
  /** ISO date. */
  dueDate: string;
  negotiationNote?: string | null;
  /** Defaults to the quotation's terms. */
  termsAndConditions?: string | null;
}

export interface InvoiceItemLine {
  srNo: number;
  quotationItemId?: string | null;
  productId: string | null;
  itemName: string;
  hsnCode: string | null;
  quantity: number;
  unitRate: number;
  taxPercent: number;
  lineAmount: number;
  lineTax: number;
  lineTotal: number;
  /** What the quotation originally offered for this line (null for a line added in negotiation). */
  quotedQuantity: number | null;
  quotedUnitRate: number | null;
}

/** Slim summary shown on a quotation that already has an invoice. */
export interface QuotationInvoiceSummary {
  id: string;
  invoiceCode: string;
  status: QuotationStatus;
  totalAmount: number;
}

export interface InvoiceListItem {
  id: string;
  invoiceCode: string;
  quotationId: string;
  quotationCode: string;
  leadId: string;
  leadName?: string;
  leadCompany?: string | null;
  status: QuotationStatus;
  totalAmount: number;
  quotedTotalAmount: number;
  isNegotiated: boolean;
  invoiceDate: string;
  dueDate: string;
  sentToPhone: string | null;
  sentAt: string | null;
  emailSentTo: string | null;
  emailSentAt: string | null;
  emailStatus: QuotationEmailStatus | null;
}

export interface InvoiceDetail extends InvoiceListItem {
  companyProfileId: string;
  customer: QuotationDraftCustomer;
  items: InvoiceItemLine[];
  subtotal: number;
  gstAmount: number;
  isIntraState: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  roundoff: number;
  advancePercent: number;
  beforeDispatchPercent: number;
  advanceAmount: number;
  beforeDispatchAmount: number;
  termsAndConditions: string;
  negotiationNote: string | null;
  /** Code of the revised quotation attached to the invoice; null when the original went unchanged. */
  revisedQuotationCode: string | null;
  whatsappMessageId: string | null;
  /** True once any send succeeded — the invoice can no longer be edited. */
  locked: boolean;
}

/** Returned by the send endpoints: the invoice plus the files that went out together. */
export interface SendInvoiceResponse extends InvoiceDetail {
  attachmentsSent: string[];
}
