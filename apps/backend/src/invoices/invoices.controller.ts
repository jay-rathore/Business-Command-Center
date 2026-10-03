import { Body, Controller, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SendEmailDto } from "../quotations/dto/send-email.dto";
import { SendWhatsAppDto } from "../quotations/dto/send-whatsapp.dto";
import { InvoicesService } from "./invoices.service";
import { SaveInvoiceDto } from "./dto/save-invoice.dto";
import { InvoicesListQueryDto } from "./dto/invoices-list-query.dto";

// Invoices are part of the quotation workflow, so they use the same permissions as quotations:
// leads:read to look, leads:write to create / edit / send.
@Controller()
@RequirePermission("leads:read")
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get("invoices")
  findAll(@Query() query: InvoicesListQueryDto) {
    return this.invoices.findAll(query);
  }

  @Get("invoices/:id")
  findOne(@Param("id") id: string) {
    return this.invoices.findOne(id);
  }

  @Get("invoices/:id/pdf")
  async getPdf(@Param("id") id: string, @Res() res: Response) {
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(await this.invoices.getPdfPath(id));
  }

  /** The quotation that travels with the invoice: revised with the agreed prices, or the original if unchanged. */
  @Get("invoices/:id/quotation-pdf")
  async getQuotationPdf(@Param("id") id: string, @Res() res: Response) {
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(await this.invoices.getQuotationPdfPath(id));
  }

  @Post("quotations/:quotationId/invoice")
  @RequirePermission("leads:write")
  createFromQuotation(
    @Param("quotationId") quotationId: string,
    @Body() dto: SaveInvoiceDto,
    @CurrentUser("salesExecutiveId") salesExecutiveId: string | null,
  ) {
    return this.invoices.createFromQuotation(quotationId, dto, salesExecutiveId);
  }

  @Patch("invoices/:id")
  @RequirePermission("leads:write")
  update(@Param("id") id: string, @Body() dto: SaveInvoiceDto) {
    return this.invoices.update(id, dto);
  }

  @Post("invoices/:id/send-email")
  @RequirePermission("leads:write")
  sendEmail(@Param("id") id: string, @Body() dto: SendEmailDto) {
    return this.invoices.sendEmail(id, dto.email);
  }

  @Post("invoices/:id/send-whatsapp")
  @RequirePermission("leads:write")
  sendWhatsApp(@Param("id") id: string, @Body() dto: SendWhatsAppDto) {
    return this.invoices.sendWhatsApp(id, dto.phone);
  }
}
