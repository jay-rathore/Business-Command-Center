import { Injectable, Logger } from "@nestjs/common";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import Handlebars from "handlebars";
import puppeteer from "puppeteer";
import { CompanyProfile } from "@hpl/shared";

export interface QuotationPdfItem {
  srNo: number;
  itemName: string;
  hsnCode: string | null;
  quantity: number;
  unitRate: number;
  taxPercent: number;
  lineTotal: number;
}

export interface QuotationPdfData {
  quotationCode: string;
  quotationDate: Date;
  validUntil: Date;
  company: CompanyProfile;
  customer: { name: string; company: string | null; address: string; city: string; state: string; gstin: string | null; contact: string };
  items: QuotationPdfItem[];
  subtotal: number;
  gstAmount: number;
  roundoff: number;
  totalAmount: number;
  advancePercent: number;
  advanceAmount: number;
  beforeDispatchPercent: number;
  beforeDispatchAmount: number;
  termsAndConditions: string;
}

const UPLOAD_DIR = join(process.cwd(), "uploads", "quotations");

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Renders the fixed quotation.hbs template with per-quotation data via Puppeteer — this one
 * template file is the "same theme every time" guarantee: every quotation goes through the
 * exact same HTML/CSS, only the data substituted differs. */
@Injectable()
export class QuotationPdfService {
  private readonly logger = new Logger(QuotationPdfService.name);
  private compiledTemplate: HandlebarsTemplateDelegate | undefined;

  private getTemplate(): HandlebarsTemplateDelegate {
    if (!this.compiledTemplate) {
      // Resolved from process.cwd() rather than __dirname: nest-cli's asset copier places
      // non-TS files at <outDir>/quotations/templates/ (relative to sourceRoot "src"), but tsc
      // itself compiles to <outDir>/src/quotations/ (its rootDir inference widens to include
      // prisma/*.ts too) — the two don't line up, but both are stable relative to cwd, which is
      // always the directory containing dist/ (apps/backend in dev, /app in the prod image).
      const source = readFileSync(join(process.cwd(), "dist", "quotations", "templates", "quotation.hbs"), "utf-8");
      this.compiledTemplate = Handlebars.compile(source);
    }
    return this.compiledTemplate;
  }

  async generate(data: QuotationPdfData): Promise<{ buffer: Buffer; pdfPath: string }> {
    const html = this.getTemplate()({
      quotationCode: data.quotationCode,
      quotationDateFormatted: formatDate(data.quotationDate),
      validUntilFormatted: formatDate(data.validUntil),
      company: data.company,
      customer: data.customer,
      items: data.items.map((item) => ({
        ...item,
        unitRateFormatted: formatMoney(item.unitRate),
        lineTotalFormatted: formatMoney(item.lineTotal),
      })),
      subtotalFormatted: formatMoney(data.subtotal),
      gstAmountFormatted: formatMoney(data.gstAmount),
      roundoffFormatted: formatMoney(data.roundoff),
      totalAmountFormatted: formatMoney(data.totalAmount),
      advancePercent: data.advancePercent,
      advanceAmountFormatted: formatMoney(data.advanceAmount),
      beforeDispatchPercent: data.beforeDispatchPercent,
      beforeDispatchAmountFormatted: formatMoney(data.beforeDispatchAmount),
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
    const pdfPath = join(UPLOAD_DIR, `${data.quotationCode}.pdf`);
    writeFileSync(pdfPath, buffer);
    this.logger.log(`Generated quotation PDF at ${pdfPath}`);

    return { buffer, pdfPath };
  }
}
