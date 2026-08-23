import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityType, IntegrationProvider, Prisma } from "@prisma/client";
import {
  CompanyProfileOption,
  PaginatedResponse,
  ProductCatalogOption,
  QuotationDetail,
  QuotationDraft,
  QuotationListItem,
} from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { TenantContext } from "../common/context/tenant-context";
import { IntegrationConnectionsService } from "../integration-connections/integration-connections.service";
import type { WhatsAppCredentials, EmailSmtpCredentials } from "../integration-connections/credential-types";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { LeadsService } from "../leads/leads.service";
import { CompanyProfilesService } from "../company-profiles/company-profiles.service";
import { WhatsAppService } from "../integrations/whatsapp/whatsapp.service";
import { normalizeWhatsAppPhone } from "../integrations/whatsapp/phone.util";
import { EmailService } from "../integrations/email/email.service";
import { QuotationNumberingService } from "./quotation-numbering.service";
import { QuotationAiParserService } from "./quotation-ai-parser.service";
import { QuotationPdfService } from "./quotation-pdf.service";
import { CreateQuotationDto } from "./dto/create-quotation.dto";
import { ParseQuotationTextDto } from "./dto/parse-quotation-text.dto";
import { QuotationsListQueryDto } from "./dto/quotations-list-query.dto";

@Injectable()
export class QuotationsService {
  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly leadsService: LeadsService,
    private readonly companyProfiles: CompanyProfilesService,
    private readonly whatsapp: WhatsAppService,
    private readonly email: EmailService,
    private readonly integrationConnections: IntegrationConnectionsService,
    private readonly numbering: QuotationNumberingService,
    private readonly aiParser: QuotationAiParserService,
    private readonly pdf: QuotationPdfService,
  ) {}

  getCompanyProfileOptions(): Promise<CompanyProfileOption[]> {
    return this.companyProfiles.findOptions();
  }

  async getProductCatalog(): Promise<ProductCatalogOption[]> {
    const rows = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, shade: true },
      take: 500,
    });
    return rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      categoryName: p.category.name,
      shadeName: p.shade?.name ?? null,
      unitPrice: Number(p.unitPrice),
    }));
  }

  private async getLeadForQuotation(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException("Lead not found");
    return lead;
  }

  async parseText(leadId: string, dto: ParseQuotationTextDto): Promise<QuotationDraft> {
    const [lead, catalog] = await Promise.all([this.getLeadForQuotation(leadId), this.getProductCatalog()]);
    return this.aiParser.parse(dto.text, {
      lead: { name: lead.name, company: lead.company, phone: lead.phone, city: lead.city, state: lead.state },
      catalog,
    });
  }

  async listForLead(leadId: string): Promise<QuotationListItem[]> {
    const rows = await this.prisma.quotation.findMany({ where: { leadId }, orderBy: { createdAt: "desc" } });
    return rows.map(this.toListItem);
  }

  /** All quotations across every lead — backs the standalone "Quotations" section so an
   * operator can find/resend/start a quotation without first drilling into a specific lead. */
  async findAll(query: QuotationsListQueryDto): Promise<PaginatedResponse<QuotationListItem>> {
    const { page, pageSize, sortBy, sortDir, q } = query;

    const where: Prisma.QuotationWhereInput = q
      ? {
          OR: [
            { quotationCode: { contains: q, mode: "insensitive" as const } },
            { customerName: { contains: q, mode: "insensitive" as const } },
            { customerCompany: { contains: q, mode: "insensitive" as const } },
            { lead: { is: { name: { contains: q, mode: "insensitive" as const } } } },
            { lead: { is: { company: { contains: q, mode: "insensitive" as const } } } },
          ],
        }
      : {};

    const orderBy: Prisma.QuotationOrderByWithRelationInput =
      sortBy === "totalAmount"
        ? { totalAmount: sortDir }
        : sortBy === "quotationCode"
          ? { quotationCode: sortDir }
          : { quotationDate: sortDir };

    const [rows, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        include: { lead: { select: { name: true, company: true } } },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => ({ ...this.toListItem(row), leadName: row.lead.name, leadCompany: row.lead.company })),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string): Promise<QuotationDetail> {
    const row = await this.prisma.quotation.findUnique({ where: { id }, include: { items: { orderBy: { srNo: "asc" } } } });
    if (!row) throw new NotFoundException("Quotation not found");
    return this.toDetail(row);
  }

  async getPdfPath(id: string): Promise<string> {
    const row = await this.prisma.quotation.findUnique({ where: { id } });
    if (!row || !row.pdfPath) throw new NotFoundException("Quotation PDF not found");
    return row.pdfPath;
  }

  async create(leadId: string, dto: CreateQuotationDto, createdById: string | null): Promise<QuotationDetail> {
    const organizationId = TenantContext.get().organizationId;
    const [lead, companyProfile] = await Promise.all([
      this.getLeadForQuotation(leadId),
      this.companyProfiles.findOne(dto.companyProfileId),
    ]);

    // Totals are always recomputed server-side — client-submitted amounts are never trusted.
    const items = dto.items.map((item, index) => {
      const lineAmount = round2(item.quantity * item.unitRate);
      const lineTax = round2((lineAmount * item.taxPercent) / 100);
      return {
        srNo: index + 1,
        productId: item.productId ?? null,
        itemName: item.itemName,
        hsnCode: item.hsnCode ?? null,
        quantity: item.quantity,
        unitRate: item.unitRate,
        taxPercent: item.taxPercent,
        lineAmount,
        lineTax,
        lineTotal: round2(lineAmount + lineTax),
      };
    });

    const subtotal = round2(items.reduce((sum, i) => sum + i.lineAmount, 0));
    const gstAmount = round2(items.reduce((sum, i) => sum + i.lineTax, 0));
    const rawTotal = subtotal + gstAmount;
    const totalAmount = Math.round(rawTotal);
    const roundoff = round2(totalAmount - rawTotal);
    const advanceAmount = Math.round((totalAmount * dto.advancePercent) / 100);
    const beforeDispatchAmount = totalAmount - advanceAmount;

    const quotationCode = await this.numbering.next();
    const quotationDate = new Date();
    const validUntil = new Date(dto.validUntil);
    const customer = {
      name: dto.customer.name,
      company: dto.customer.company ?? null,
      address: dto.customer.address,
      city: dto.customer.city,
      state: dto.customer.state,
      gstin: dto.customer.gstin ?? null,
      contact: dto.customer.contact,
    };

    const { pdfPath } = await this.pdf.generate({
      quotationCode,
      quotationDate,
      validUntil,
      company: companyProfile,
      customer,
      items: items.map((i) => ({
        srNo: i.srNo,
        itemName: i.itemName,
        hsnCode: i.hsnCode,
        quantity: i.quantity,
        unitRate: i.unitRate,
        taxPercent: i.taxPercent,
        lineTotal: i.lineTotal,
      })),
      subtotal,
      gstAmount,
      roundoff,
      totalAmount,
      advancePercent: dto.advancePercent,
      advanceAmount,
      beforeDispatchPercent: dto.beforeDispatchPercent,
      beforeDispatchAmount,
      termsAndConditions: dto.termsAndConditions,
    });

    const row = await this.prisma.quotation.create({
      data: {
        organizationId,
        quotationCode,
        leadId: lead.id,
        companyProfileId: companyProfile.id,
        customerName: customer.name,
        customerCompany: customer.company,
        customerAddress: customer.address,
        customerCity: customer.city,
        customerState: customer.state,
        customerGstin: customer.gstin,
        customerContact: customer.contact,
        quotationDate,
        validUntil,
        subtotal,
        gstAmount,
        roundoff,
        totalAmount,
        advancePercent: dto.advancePercent,
        beforeDispatchPercent: dto.beforeDispatchPercent,
        advanceAmount,
        beforeDispatchAmount,
        termsAndConditions: dto.termsAndConditions,
        inputMode: dto.inputMode,
        rawInputText: dto.rawInputText,
        pdfPath,
        createdById,
        // Nested writes bypass the org-scope Prisma extension (it only intercepts top-level
        // model.method calls), so QuotationItem.organizationId must be set explicitly here.
        items: { create: items.map((i) => ({ ...i, organizationId })) },
      },
      include: { items: { orderBy: { srNo: "asc" } } },
    });

    return this.toDetail(row);
  }

  async sendWhatsApp(id: string, phoneOverride: string | undefined): Promise<QuotationDetail> {
    const organizationId = TenantContext.get().organizationId;
    const credentials = await this.integrationConnections.getCredentials<WhatsAppCredentials>(
      organizationId,
      IntegrationProvider.WHATSAPP,
    );
    if (!credentials) throw new BadRequestException("WhatsApp isn't configured for this organization yet");

    const row = await this.prisma.quotation.findUnique({
      where: { id },
      include: { items: true, lead: true, companyProfile: true },
    });
    if (!row) throw new NotFoundException("Quotation not found");
    if (!row.pdfPath) throw new NotFoundException("Quotation has no generated PDF");

    const phone = phoneOverride || row.lead.phone;
    const { readFileSync } = await import("fs");
    const buffer = readFileSync(row.pdfPath);

    try {
      const mediaId = await this.whatsapp.uploadMedia(credentials, buffer, `${row.quotationCode}.pdf`, "application/pdf");
      const messageId = await this.whatsapp.sendDocumentMessage(
        credentials,
        phone,
        mediaId,
        `${row.quotationCode}.pdf`,
        `Your quotation ${row.quotationCode} from ${row.companyProfile.name}`,
      );

      const sentAt = new Date();
      const updated = await this.prisma.quotation.update({
        where: { id },
        data: {
          status: "SENT",
          sentToPhone: normalizeWhatsAppPhone(phone),
          whatsappMessageId: messageId,
          sentAt,
        },
        include: { items: { orderBy: { srNo: "asc" } } },
      });

      await this.leadsService.addActivity(row.leadId, {
        type: ActivityType.QUOTE_SENT,
        note: `Quotation ${row.quotationCode} sent via WhatsApp to ${phone}`,
      });

      return this.toDetail(updated);
    } catch (err) {
      await this.prisma.quotation.update({ where: { id }, data: { status: "SEND_FAILED" } });
      throw err;
    }
  }

  async sendEmail(id: string, emailOverride: string | undefined): Promise<QuotationDetail> {
    const organizationId = TenantContext.get().organizationId;
    const credentials = await this.integrationConnections.getCredentials<EmailSmtpCredentials>(
      organizationId,
      IntegrationProvider.EMAIL_SMTP,
    );
    if (!credentials) throw new BadRequestException("Email isn't configured for this organization yet");

    const row = await this.prisma.quotation.findUnique({
      where: { id },
      include: { items: true, lead: true, companyProfile: true },
    });
    if (!row) throw new NotFoundException("Quotation not found");
    if (!row.pdfPath) throw new NotFoundException("Quotation has no generated PDF");

    const to = emailOverride || row.lead.email;
    if (!to) throw new BadRequestException("This lead has no email on file — enter one to send to");

    const { readFileSync } = await import("fs");
    const buffer = readFileSync(row.pdfPath);

    try {
      await this.email.sendQuotationEmail(credentials, {
        to,
        subject: `Your quotation ${row.quotationCode} from ${row.companyProfile.name}`,
        bodyText: `Hi ${row.customerName},\n\nPlease find attached your quotation ${row.quotationCode}, valid until ${row.validUntil.toDateString()}.\n\nThank you for considering ${row.companyProfile.name}.`,
        attachmentBuffer: buffer,
        attachmentFilename: `${row.quotationCode}.pdf`,
      });

      const emailSentAt = new Date();
      const updated = await this.prisma.quotation.update({
        where: { id },
        data: { emailStatus: "SENT", emailSentTo: to, emailSentAt },
        include: { items: { orderBy: { srNo: "asc" } } },
      });

      await this.leadsService.addActivity(row.leadId, {
        type: ActivityType.EMAIL,
        note: `Quotation ${row.quotationCode} emailed to ${to}`,
      });

      return this.toDetail(updated);
    } catch (err) {
      await this.prisma.quotation.update({ where: { id }, data: { emailStatus: "FAILED" } });
      throw err;
    }
  }

  private toListItem = (row: {
    id: string;
    quotationCode: string;
    leadId: string;
    status: string;
    inputMode: string;
    totalAmount: unknown;
    quotationDate: Date;
    validUntil: Date;
    sentToPhone: string | null;
    sentAt: Date | null;
    emailSentTo: string | null;
    emailSentAt: Date | null;
    emailStatus: string | null;
  }): QuotationListItem => ({
    id: row.id,
    quotationCode: row.quotationCode,
    leadId: row.leadId,
    status: row.status as QuotationListItem["status"],
    inputMode: row.inputMode as QuotationListItem["inputMode"],
    totalAmount: Number(row.totalAmount),
    quotationDate: row.quotationDate.toISOString(),
    validUntil: row.validUntil.toISOString(),
    sentToPhone: row.sentToPhone,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    emailSentTo: row.emailSentTo,
    emailSentAt: row.emailSentAt ? row.emailSentAt.toISOString() : null,
    emailStatus: row.emailStatus as QuotationListItem["emailStatus"],
  });

  private toDetail = (row: {
    id: string;
    quotationCode: string;
    leadId: string;
    companyProfileId: string;
    status: string;
    inputMode: string;
    customerName: string;
    customerCompany: string | null;
    customerAddress: string;
    customerCity: string;
    customerState: string;
    customerGstin: string | null;
    customerContact: string;
    subtotal: unknown;
    gstAmount: unknown;
    roundoff: unknown;
    totalAmount: unknown;
    advancePercent: number;
    beforeDispatchPercent: number;
    advanceAmount: unknown;
    beforeDispatchAmount: unknown;
    termsAndConditions: string;
    quotationDate: Date;
    validUntil: Date;
    sentToPhone: string | null;
    sentAt: Date | null;
    emailSentTo: string | null;
    emailSentAt: Date | null;
    emailStatus: string | null;
    whatsappMessageId: string | null;
    items: {
      srNo: number;
      productId: string | null;
      itemName: string;
      hsnCode: string | null;
      quantity: number;
      unitRate: unknown;
      taxPercent: unknown;
      lineAmount: unknown;
      lineTax: unknown;
      lineTotal: unknown;
    }[];
  }): QuotationDetail => ({
    id: row.id,
    quotationCode: row.quotationCode,
    leadId: row.leadId,
    companyProfileId: row.companyProfileId,
    status: row.status as QuotationDetail["status"],
    inputMode: row.inputMode as QuotationDetail["inputMode"],
    totalAmount: Number(row.totalAmount),
    quotationDate: row.quotationDate.toISOString(),
    validUntil: row.validUntil.toISOString(),
    sentToPhone: row.sentToPhone,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    emailSentTo: row.emailSentTo,
    emailSentAt: row.emailSentAt ? row.emailSentAt.toISOString() : null,
    emailStatus: row.emailStatus as QuotationDetail["emailStatus"],
    whatsappMessageId: row.whatsappMessageId,
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
      productId: i.productId,
      itemName: i.itemName,
      hsnCode: i.hsnCode,
      quantity: i.quantity,
      unitRate: Number(i.unitRate),
      taxPercent: Number(i.taxPercent),
      lineAmount: Number(i.lineAmount),
      lineTax: Number(i.lineTax),
      lineTotal: Number(i.lineTotal),
    })),
    subtotal: Number(row.subtotal),
    gstAmount: Number(row.gstAmount),
    roundoff: Number(row.roundoff),
    advancePercent: row.advancePercent,
    beforeDispatchPercent: row.beforeDispatchPercent,
    advanceAmount: Number(row.advanceAmount),
    beforeDispatchAmount: Number(row.beforeDispatchAmount),
    termsAndConditions: row.termsAndConditions,
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
