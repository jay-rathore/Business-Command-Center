import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityType, IntegrationProvider, Prisma } from "@prisma/client";
import { readFileSync } from "fs";
import { computeLine, computeTotals, gstSplit, InvoiceDetail, InvoiceListItem, PaginatedResponse, SendInvoiceResponse } from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { TenantContext } from "../common/context/tenant-context";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { IntegrationConnectionsService } from "../integration-connections/integration-connections.service";
import type { EmailSmtpCredentials, WhatsAppCredentials } from "../integration-connections/credential-types";
import { LeadsService } from "../leads/leads.service";
import { CompanyProfilesService } from "../company-profiles/company-profiles.service";
import { WhatsAppService } from "../integrations/whatsapp/whatsapp.service";
import { normalizeWhatsAppPhone } from "../integrations/whatsapp/phone.util";
import { EmailService } from "../integrations/email/email.service";
import { QuotationPdfService } from "../quotations/quotation-pdf.service";
import { InvoiceNumberingService } from "./invoice-numbering.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import { SaveInvoiceDto } from "./dto/save-invoice.dto";
import { InvoicesListQueryDto } from "./dto/invoices-list-query.dto";

const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const DETAIL_INCLUDE = {
  items: { orderBy: { srNo: "asc" } },
  quotation: { select: { quotationCode: true } },
  companyProfile: { select: { state: true } },
  lead: { select: { name: true, company: true } },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof DETAIL_INCLUDE }>;

/** Invoices raised from a quotation once the customer confirms. The agreed (often negotiated) prices live on
 * the invoice; the original quotation is never edited. When prices changed, an "updated quotation" PDF
 * (code <PI>-R1) is generated and goes out together with the invoice. */
@Injectable()
export class InvoicesService {
  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly leadsService: LeadsService,
    private readonly companyProfiles: CompanyProfilesService,
    private readonly whatsapp: WhatsAppService,
    private readonly email: EmailService,
    private readonly integrationConnections: IntegrationConnectionsService,
    private readonly numbering: InvoiceNumberingService,
    private readonly invoicePdf: InvoicePdfService,
    private readonly quotationPdf: QuotationPdfService,
  ) {}

  // ── queries ────────────────────────────────────────────────────────────────

  async findAll(query: InvoicesListQueryDto): Promise<PaginatedResponse<InvoiceListItem>> {
    const { page, pageSize, sortBy, sortDir, q } = query;
    const contains = (v: string) => ({ contains: v, mode: "insensitive" as const });
    const where: Prisma.InvoiceWhereInput = q
      ? {
          OR: [
            { invoiceCode: contains(q) },
            { customerName: contains(q) },
            { customerCompany: contains(q) },
            { quotation: { is: { quotationCode: contains(q) } } },
            { lead: { is: { name: contains(q) } } },
          ],
        }
      : {};
    const orderBy: Prisma.InvoiceOrderByWithRelationInput =
      sortBy === "totalAmount" ? { totalAmount: sortDir } : sortBy === "invoiceCode" ? { invoiceCode: sortDir } : sortBy === "dueDate" ? { dueDate: sortDir } : { invoiceDate: sortDir };

    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({ where, include: DETAIL_INCLUDE, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.invoice.count({ where }),
    ]);
    return buildPaginatedResponse(rows.map((r) => this.toListItem(r)), total, page, pageSize);
  }

  async findOne(id: string): Promise<InvoiceDetail> {
    return this.toDetail(await this.load(id));
  }

  async getPdfPath(id: string): Promise<string> {
    const row = await this.prisma.invoice.findUnique({ where: { id } });
    if (!row?.pdfPath) throw new NotFoundException("Invoice PDF not found");
    return row.pdfPath;
  }

  async getQuotationPdfPath(id: string): Promise<string> {
    const row = await this.prisma.invoice.findUnique({ where: { id } });
    if (!row?.quotationPdfPath) throw new NotFoundException("Updated quotation PDF not found");
    return row.quotationPdfPath;
  }

  // ── create / edit ──────────────────────────────────────────────────────────

  async createFromQuotation(quotationId: string, dto: SaveInvoiceDto, createdById: string | null): Promise<InvoiceDetail> {
    const organizationId = TenantContext.get().organizationId;
    const quotation = await this.prisma.quotation.findUnique({ where: { id: quotationId }, include: { items: true, invoice: { select: { invoiceCode: true } } } });
    if (!quotation) throw new NotFoundException("Quotation not found");
    if (quotation.invoice) throw new ConflictException(`This quotation already has invoice ${quotation.invoice.invoiceCode} — open it to edit.`);

    const company = await this.companyProfiles.findOne(quotation.companyProfileId);
    const built = this.build(dto, quotation);
    const invoiceCode = await this.numbering.next();
    const invoiceDate = new Date();
    const dueDate = new Date(dto.dueDate);

    const files = await this.renderFiles({ quotation, company, built, invoiceCode, invoiceDate, dueDate, dto });

    let row: InvoiceRow;
    try {
      row = await this.prisma.invoice.create({
        data: {
          organizationId,
          invoiceCode,
          quotationId: quotation.id,
          leadId: quotation.leadId,
          companyProfileId: quotation.companyProfileId,
          customerName: quotation.customerName,
          customerCompany: quotation.customerCompany,
          customerAddress: quotation.customerAddress,
          customerCity: quotation.customerCity,
          customerState: quotation.customerState,
          customerGstin: quotation.customerGstin,
          customerContact: quotation.customerContact,
          invoiceDate,
          dueDate,
          ...built.totals,
          advancePercent: dto.advancePercent,
          beforeDispatchPercent: dto.beforeDispatchPercent,
          termsAndConditions: dto.termsAndConditions?.trim() || quotation.termsAndConditions,
          quotedTotalAmount: quotation.totalAmount,
          isNegotiated: built.isNegotiated,
          negotiationNote: dto.negotiationNote?.trim() || null,
          revisedQuotationCode: files.revisedQuotationCode,
          pdfPath: files.pdfPath,
          quotationPdfPath: files.quotationPdfPath,
          createdById,
          // Nested writes bypass the org-scope extension, so organizationId is set explicitly.
          items: { create: built.lines.map((l) => ({ ...l, organizationId })) },
        },
        include: DETAIL_INCLUDE,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("This quotation already has an invoice.");
      }
      throw err;
    }

    await this.leadsService.addActivity(quotation.leadId, {
      type: ActivityType.NOTE,
      note: built.isNegotiated
        ? `Invoice ${invoiceCode} created from ${quotation.quotationCode} at the negotiated price (${money(Number(quotation.totalAmount))} → ${money(built.totals.totalAmount)})`
        : `Invoice ${invoiceCode} created from ${quotation.quotationCode}`,
    });
    return this.toDetail(row);
  }

  /** Edits an invoice that has not been sent yet (e.g. the customer negotiated again). */
  async update(id: string, dto: SaveInvoiceDto): Promise<InvoiceDetail> {
    const organizationId = TenantContext.get().organizationId;
    const existing = await this.load(id);
    if (this.isLocked(existing)) throw new ConflictException("This invoice has already been sent, so it can no longer be edited.");

    const quotation = await this.prisma.quotation.findUnique({ where: { id: existing.quotationId }, include: { items: true } });
    if (!quotation) throw new NotFoundException("Quotation not found");
    const company = await this.companyProfiles.findOne(existing.companyProfileId);
    const built = this.build(dto, quotation);
    const dueDate = new Date(dto.dueDate);

    const files = await this.renderFiles({ quotation, company, built, invoiceCode: existing.invoiceCode, invoiceDate: existing.invoiceDate, dueDate, dto });

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          dueDate,
          ...built.totals,
          advancePercent: dto.advancePercent,
          beforeDispatchPercent: dto.beforeDispatchPercent,
          termsAndConditions: dto.termsAndConditions?.trim() || quotation.termsAndConditions,
          isNegotiated: built.isNegotiated,
          negotiationNote: dto.negotiationNote?.trim() || null,
          revisedQuotationCode: files.revisedQuotationCode,
          pdfPath: files.pdfPath,
          quotationPdfPath: files.quotationPdfPath,
          items: { create: built.lines.map((l) => ({ ...l, organizationId })) },
        },
        include: DETAIL_INCLUDE,
      });
    });
    return this.toDetail(row);
  }

  // ── sending ────────────────────────────────────────────────────────────────

  async sendEmail(id: string, emailOverride: string | undefined): Promise<SendInvoiceResponse> {
    const organizationId = TenantContext.get().organizationId;
    const credentials = await this.integrationConnections.getCredentials<EmailSmtpCredentials>(organizationId, IntegrationProvider.EMAIL_SMTP);
    if (!credentials) throw new BadRequestException("Email isn't configured for this organization yet");

    const row = await this.load(id);
    const lead = await this.prisma.lead.findUnique({ where: { id: row.leadId }, select: { email: true } });
    const company = await this.companyProfiles.findOne(row.companyProfileId);
    const to = emailOverride || lead?.email;
    if (!to) throw new BadRequestException("This lead has no email on file — enter one to send to");

    const docs = this.documents(row);
    const attachments = docs.map((d) => ({ filename: d.filename, buffer: readFileSync(d.path) }));

    try {
      await this.email.sendDocumentsEmail(credentials, {
        to,
        subject: `Invoice ${row.invoiceCode} from ${company.name}`,
        bodyText: this.emailBody(row, company.name),
        attachments,
        failureMessage: "Failed to send the invoice via email",
      });
      await this.prisma.invoice.update({ where: { id }, data: { emailStatus: "SENT", emailSentTo: to, emailSentAt: new Date() } });
      await this.leadsService.addActivity(row.leadId, {
        type: ActivityType.EMAIL,
        note: `Invoice ${row.invoiceCode} and ${docs[1].filename.replace(".pdf", "")} emailed to ${to}`,
      });
    } catch (err) {
      await this.prisma.invoice.update({ where: { id }, data: { emailStatus: "FAILED" } });
      throw err;
    }
    return { ...(await this.findOne(id)), attachmentsSent: docs.map((d) => d.filename) };
  }

  async sendWhatsApp(id: string, phoneOverride: string | undefined): Promise<SendInvoiceResponse> {
    const organizationId = TenantContext.get().organizationId;
    const credentials = await this.integrationConnections.getCredentials<WhatsAppCredentials>(organizationId, IntegrationProvider.WHATSAPP);
    if (!credentials) throw new BadRequestException("WhatsApp isn't configured for this organization yet");

    const row = await this.load(id);
    const lead = await this.prisma.lead.findUnique({ where: { id: row.leadId }, select: { phone: true } });
    const company = await this.companyProfiles.findOne(row.companyProfileId);
    const phone = phoneOverride || lead?.phone;
    if (!phone) throw new BadRequestException("No phone number to send to");

    const docs = this.documents(row);
    try {
      let messageId: string | null = null;
      for (const doc of docs) {
        const mediaId = await this.whatsapp.uploadMedia(credentials, readFileSync(doc.path), doc.filename, "application/pdf");
        messageId = await this.whatsapp.sendDocumentMessage(credentials, phone, mediaId, doc.filename, `${doc.caption} — ${company.name}`);
      }
      await this.prisma.invoice.update({
        where: { id },
        data: { status: "SENT", sentToPhone: normalizeWhatsAppPhone(phone), whatsappMessageId: messageId, sentAt: new Date() },
      });
      await this.leadsService.addActivity(row.leadId, {
        type: ActivityType.WHATSAPP,
        note: `Invoice ${row.invoiceCode} and ${docs[1].filename.replace(".pdf", "")} sent via WhatsApp to ${phone}`,
      });
    } catch (err) {
      await this.prisma.invoice.update({ where: { id }, data: { status: "SEND_FAILED" } });
      throw err;
    }
    return { ...(await this.findOne(id)), attachmentsSent: docs.map((d) => d.filename) };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async load(id: string): Promise<InvoiceRow> {
    const row = await this.prisma.invoice.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!row) throw new NotFoundException("Invoice not found");
    return row;
  }

  private isLocked(row: { status: string; emailStatus: string | null }): boolean {
    return row.status === "SENT" || row.emailStatus === "SENT";
  }

  /** The two files that always travel together: the tax invoice and the updated quotation. */
  private documents(row: InvoiceRow) {
    if (!row.pdfPath || !row.quotationPdfPath) throw new NotFoundException("Invoice files are missing — save the invoice again");
    const quotationLabel = row.revisedQuotationCode ?? row.quotation.quotationCode;
    return [
      { filename: `${row.invoiceCode}.pdf`, path: row.pdfPath, caption: `Tax invoice ${row.invoiceCode}` },
      {
        filename: `${quotationLabel}.pdf`,
        path: row.quotationPdfPath,
        caption: row.revisedQuotationCode ? `Updated quotation ${quotationLabel} (agreed prices)` : `Quotation ${quotationLabel}`,
      },
    ];
  }

  private emailBody(row: InvoiceRow, companyName: string): string {
    const total = Number(row.totalAmount);
    const quotationLine = row.revisedQuotationCode
      ? `2. Updated quotation ${row.revisedQuotationCode} — your quotation revised with the prices we agreed on`
      : `2. Quotation ${row.quotation.quotationCode} — unchanged, for your records`;
    return [
      `Hi ${row.customerName},`,
      "",
      "Thank you for confirming your order. Please find attached:",
      `1. Tax invoice ${row.invoiceCode} for ${money(total)}`,
      quotationLine,
      "",
      `Payment: ${row.advancePercent}% advance (${money(Number(row.advanceAmount))}) and ${row.beforeDispatchPercent}% before dispatch (${money(Number(row.beforeDispatchAmount))}). Due by ${day(row.dueDate)}.`,
      "Our bank details are on the invoice.",
      "",
      `Regards,`,
      companyName,
    ].join("\n");
  }

  /** Server-side line + total maths (client amounts are never trusted) and the "was it negotiated?" test. */
  private build(
    dto: SaveInvoiceDto,
    quotation: { totalAmount: Prisma.Decimal; items: { id: string; productId: string | null; hsnCode: string | null; quantity: number; unitRate: Prisma.Decimal; taxPercent: Prisma.Decimal }[] },
  ) {
    const quoted = new Map(quotation.items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const lines = dto.items.map((item, index) => {
      let source: (typeof quotation.items)[number] | undefined;
      if (item.quotationItemId) {
        source = quoted.get(item.quotationItemId);
        if (!source) throw new BadRequestException(`Line ${index + 1} refers to a quotation line that doesn't belong to this quotation`);
        if (seen.has(item.quotationItemId)) throw new BadRequestException("The same quotation line can't appear twice");
        seen.add(item.quotationItemId);
      }
      return {
        srNo: index + 1,
        quotationItemId: source?.id ?? null,
        productId: item.productId ?? source?.productId ?? null,
        itemName: item.itemName,
        hsnCode: item.hsnCode ?? source?.hsnCode ?? null,
        quantity: item.quantity,
        unitRate: item.unitRate,
        taxPercent: item.taxPercent,
        ...computeLine(item),
        quotedQuantity: source?.quantity ?? null,
        quotedUnitRate: source ? Number(source.unitRate) : null,
        _quotedTax: source ? Number(source.taxPercent) : null,
      };
    });

    const totals = computeTotals(lines, dto.advancePercent);
    const quotedTotal = Number(quotation.totalAmount);
    const isNegotiated =
      lines.length !== quotation.items.length ||
      totals.totalAmount !== quotedTotal ||
      lines.some((l) => l.quotedUnitRate === null || l.unitRate !== l.quotedUnitRate || l.quantity !== l.quotedQuantity || l.taxPercent !== l._quotedTax);

    return {
      // `_quotedTax` is only for the comparison above — strip it before it reaches Prisma.
      lines: lines.map(({ _quotedTax, ...rest }) => rest),
      totals: { ...totals },
      quotedTotal,
      isNegotiated,
    };
  }

  /** Generates the tax invoice PDF and the updated-quotation PDF (revised if prices changed, else the original). */
  private async renderFiles(args: {
    quotation: { quotationCode: string; quotationDate: Date; validUntil: Date; pdfPath: string | null; customerName: string; customerCompany: string | null; customerAddress: string; customerCity: string; customerState: string; customerGstin: string | null; customerContact: string; termsAndConditions: string };
    company: Awaited<ReturnType<CompanyProfilesService["findOne"]>>;
    built: ReturnType<InvoicesService["build"]>;
    invoiceCode: string;
    invoiceDate: Date;
    dueDate: Date;
    dto: SaveInvoiceDto;
  }) {
    const { quotation, company, built, dto } = args;
    const terms = dto.termsAndConditions?.trim() || quotation.termsAndConditions;
    const customer = {
      name: quotation.customerName,
      company: quotation.customerCompany,
      address: quotation.customerAddress,
      city: quotation.customerCity,
      state: quotation.customerState,
      gstin: quotation.customerGstin,
      contact: quotation.customerContact,
    };
    const split = gstSplit(built.totals.gstAmount, company.state, customer.state);
    const pdfItems = built.lines.map((l) => ({ srNo: l.srNo, itemName: l.itemName, hsnCode: l.hsnCode, quantity: l.quantity, unitRate: l.unitRate, taxPercent: l.taxPercent, lineAmount: l.lineAmount, lineTotal: l.lineTotal }));
    const note = dto.negotiationNote?.trim() || null;

    let revisedQuotationCode: string | null = null;
    let quotationPdfPath = quotation.pdfPath;
    if (built.isNegotiated) {
      revisedQuotationCode = `${quotation.quotationCode}-R1`;
      const revised = await this.quotationPdf.generate({
        quotationCode: revisedQuotationCode,
        quotationDate: args.invoiceDate,
        validUntil: args.dueDate,
        company,
        customer,
        items: pdfItems.map((i) => ({ ...i })),
        subtotal: built.totals.subtotal,
        gstAmount: built.totals.gstAmount,
        roundoff: built.totals.roundoff,
        totalAmount: built.totals.totalAmount,
        advancePercent: dto.advancePercent,
        advanceAmount: built.totals.advanceAmount,
        beforeDispatchPercent: dto.beforeDispatchPercent,
        beforeDispatchAmount: built.totals.beforeDispatchAmount,
        termsAndConditions: terms,
        title: "REVISED PROFORMA INVOICE",
        revisionNote: `Revised after negotiation — supersedes ${quotation.quotationCode} dated ${day(quotation.quotationDate)} (${money(built.quotedTotal)} → ${money(built.totals.totalAmount)}).${note ? ` ${note}` : ""}`,
      });
      quotationPdfPath = revised.pdfPath;
    }

    const { pdfPath } = await this.invoicePdf.generate({
      invoiceCode: args.invoiceCode,
      invoiceDate: args.invoiceDate,
      dueDate: args.dueDate,
      quotationRef: revisedQuotationCode ?? quotation.quotationCode,
      company,
      customer,
      items: pdfItems,
      subtotal: built.totals.subtotal,
      gstAmount: built.totals.gstAmount,
      ...split,
      roundoff: built.totals.roundoff,
      totalAmount: built.totals.totalAmount,
      saving: Math.max(0, built.quotedTotal - built.totals.totalAmount),
      negotiationNote: note,
      advancePercent: dto.advancePercent,
      advanceAmount: built.totals.advanceAmount,
      beforeDispatchPercent: dto.beforeDispatchPercent,
      beforeDispatchAmount: built.totals.beforeDispatchAmount,
      termsAndConditions: terms,
    });
    return { pdfPath, quotationPdfPath, revisedQuotationCode };
  }

  private toListItem(row: InvoiceRow): InvoiceListItem {
    return {
      id: row.id,
      invoiceCode: row.invoiceCode,
      quotationId: row.quotationId,
      quotationCode: row.quotation.quotationCode,
      leadId: row.leadId,
      leadName: row.lead.name,
      leadCompany: row.lead.company,
      status: row.status,
      totalAmount: Number(row.totalAmount),
      quotedTotalAmount: Number(row.quotedTotalAmount),
      isNegotiated: row.isNegotiated,
      invoiceDate: row.invoiceDate.toISOString(),
      dueDate: row.dueDate.toISOString(),
      sentToPhone: row.sentToPhone,
      sentAt: row.sentAt ? row.sentAt.toISOString() : null,
      emailSentTo: row.emailSentTo,
      emailSentAt: row.emailSentAt ? row.emailSentAt.toISOString() : null,
      emailStatus: row.emailStatus,
    };
  }

  private toDetail(row: InvoiceRow): InvoiceDetail {
    const split = gstSplit(Number(row.gstAmount), row.companyProfile.state, row.customerState);
    return {
      ...this.toListItem(row),
      companyProfileId: row.companyProfileId,
      customer: {
        name: row.customerName,
        company: row.customerCompany,
        address: row.customerAddress,
        city: row.customerCity,
        state: row.customerState,
        gstin: row.customerGstin,
        contact: row.customerContact,
      },
      items: row.items.map((i) => ({
        srNo: i.srNo,
        quotationItemId: i.quotationItemId,
        productId: i.productId,
        itemName: i.itemName,
        hsnCode: i.hsnCode,
        quantity: i.quantity,
        unitRate: Number(i.unitRate),
        taxPercent: Number(i.taxPercent),
        lineAmount: Number(i.lineAmount),
        lineTax: Number(i.lineTax),
        lineTotal: Number(i.lineTotal),
        quotedQuantity: i.quotedQuantity,
        quotedUnitRate: i.quotedUnitRate === null ? null : Number(i.quotedUnitRate),
      })),
      subtotal: Number(row.subtotal),
      gstAmount: Number(row.gstAmount),
      ...split,
      roundoff: Number(row.roundoff),
      advancePercent: row.advancePercent,
      beforeDispatchPercent: row.beforeDispatchPercent,
      advanceAmount: Number(row.advanceAmount),
      beforeDispatchAmount: Number(row.beforeDispatchAmount),
      termsAndConditions: row.termsAndConditions,
      negotiationNote: row.negotiationNote,
      revisedQuotationCode: row.revisedQuotationCode,
      whatsappMessageId: row.whatsappMessageId,
      locked: this.isLocked(row),
    };
  }
}
