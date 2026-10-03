import { Injectable, Logger } from "@nestjs/common";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import Handlebars from "handlebars";
import puppeteer from "puppeteer";
import { amountInWords, CompanyProfile } from "@hpl/shared";

export interface InvoicePdfData {
  invoiceCode: string;
  invoiceDate: Date;
  dueDate: Date;
  quotationRef: string;
  company: CompanyProfile;
  customer: { name: string; company: string | null; address: string; city: string; state: string; gstin: string | null; contact: string };
  items: { srNo: number; itemName: string; hsnCode: string | null; quantity: number; unitRate: number; taxPercent: number; lineAmount: number; lineTotal: number }[];
  subtotal: number;
  gstAmount: number;
  isIntraState: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  roundoff: number;
  totalAmount: number;
  /** Amount knocked off the quotation by negotiation (0 when none) — shown as a line on the invoice. */
  saving: number;
  negotiationNote: string | null;
  advancePercent: number;
  advanceAmount: number;
  beforeDispatchPercent: number;
  beforeDispatchAmount: number;
  termsAndConditions: string;
}

const UPLOAD_DIR = join(process.cwd(), "uploads", "invoices");

const money = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (date: Date) => date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/** Renders invoice.hbs (the quotation theme + GST split + amount in words) to a PDF via Puppeteer. */
@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);
  private compiled: HandlebarsTemplateDelegate | undefined;

  private getTemplate(): HandlebarsTemplateDelegate {
    if (!this.compiled) {
      // Same cwd-relative lookup as QuotationPdfService (nest-cli copies assets to dist/<folder>/templates).
      const source = readFileSync(join(process.cwd(), "dist", "invoices", "templates", "invoice.hbs"), "utf-8");
      this.compiled = Handlebars.compile(source);
    }
    return this.compiled;
  }

  async generate(data: InvoicePdfData): Promise<{ buffer: Buffer; pdfPath: string }> {
    const html = this.getTemplate()({
      invoiceCode: data.invoiceCode,
      invoiceDateFormatted: day(data.invoiceDate),
      dueDateFormatted: day(data.dueDate),
      quotationRef: data.quotationRef,
      company: data.company,
      customer: data.customer,
      items: data.items.map((i) => ({ ...i, unitRateFormatted: money(i.unitRate), lineAmountFormatted: money(i.lineAmount), lineTotalFormatted: money(i.lineTotal) })),
      subtotalFormatted: money(data.subtotal),
      isIntraState: data.isIntraState,
      cgstFormatted: money(data.cgst),
      sgstFormatted: money(data.sgst),
      igstFormatted: money(data.igst),
      roundoffFormatted: money(data.roundoff),
      totalAmountFormatted: money(data.totalAmount),
      savingFormatted: data.saving > 0 ? `-${money(data.saving)}` : null,
      amountInWords: amountInWords(data.totalAmount),
      negotiationNote: data.negotiationNote,
      advancePercent: data.advancePercent,
      advanceAmountFormatted: money(data.advanceAmount),
      beforeDispatchPercent: data.beforeDispatchPercent,
      beforeDispatchAmountFormatted: money(data.beforeDispatchAmount),
      termsLines: data.termsAndConditions.split("\n").filter((line) => line.trim().length > 0),
    });

    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    let buffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      buffer = Buffer.from(await page.pdf({ format: "A4", printBackground: true }));
    } finally {
      await browser.close();
    }

    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
    const pdfPath = join(UPLOAD_DIR, `${data.invoiceCode}.pdf`);
    writeFileSync(pdfPath, buffer);
    this.logger.log(`Generated invoice PDF at ${pdfPath}`);
    return { buffer, pdfPath };
  }
}
