import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { QuotationsService } from "./quotations.service";
import { ParseQuotationTextDto } from "./dto/parse-quotation-text.dto";
import { CreateQuotationDto } from "./dto/create-quotation.dto";
import { SendWhatsAppDto } from "./dto/send-whatsapp.dto";
import { SendEmailDto } from "./dto/send-email.dto";
import { QuotationsListQueryDto } from "./dto/quotations-list-query.dto";

@Controller()
@RequirePermission("leads:read")
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @Get("quotations")
  findAll(@Query() query: QuotationsListQueryDto) {
    return this.quotations.findAll(query);
  }

  @Get("quotations/company-profile-options")
  getCompanyProfileOptions() {
    return this.quotations.getCompanyProfileOptions();
  }

  // Slim, leads:read-gated catalog read for the item picker — SALES_EXECUTIVE has leads:read
  // but not products:read, so this deliberately doesn't reuse GET /products.
  @Get("quotations/products")
  getProductCatalog() {
    return this.quotations.getProductCatalog();
  }

  @Post("leads/:leadId/quotations/parse")
  @RequirePermission("leads:write")
  parse(@Param("leadId") leadId: string, @Body() dto: ParseQuotationTextDto) {
    return this.quotations.parseText(leadId, dto);
  }

  @Get("leads/:leadId/quotations")
  listForLead(@Param("leadId") leadId: string) {
    return this.quotations.listForLead(leadId);
  }

  @Post("leads/:leadId/quotations")
  @RequirePermission("leads:write")
  create(
    @Param("leadId") leadId: string,
    @Body() dto: CreateQuotationDto,
    @CurrentUser("salesExecutiveId") salesExecutiveId: string | null,
  ) {
    return this.quotations.create(leadId, dto, salesExecutiveId);
  }

  @Get("quotations/:id")
  findOne(@Param("id") id: string) {
    return this.quotations.findOne(id);
  }

  @Get("quotations/:id/pdf")
  async getPdf(@Param("id") id: string, @Res() res: Response) {
    const pdfPath = await this.quotations.getPdfPath(id);
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(pdfPath);
  }

  @Post("quotations/:id/send-whatsapp")
  @RequirePermission("leads:write")
  sendWhatsApp(@Param("id") id: string, @Body() dto: SendWhatsAppDto) {
    return this.quotations.sendWhatsApp(id, dto.phone);
  }

  @Post("quotations/:id/send-email")
  @RequirePermission("leads:write")
  sendEmail(@Param("id") id: string, @Body() dto: SendEmailDto) {
    return this.quotations.sendEmail(id, dto.email);
  }
}
