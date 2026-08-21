import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { QuotationDraft } from "@hpl/shared";

export interface QuotationParseContext {
  lead: { name: string; company: string | null; phone: string; city: string; state: string };
  catalog: { id: string; sku: string; name: string; categoryName: string; shadeName: string | null; unitPrice: number }[];
}

const EXTRACT_TOOL_NAME = "extract_quotation";

const EXTRACT_TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: EXTRACT_TOOL_NAME,
    description: "Extract structured quotation fields from a free-text sales request.",
    parameters: {
      type: "object",
      properties: {
        customer: {
          type: "object",
          properties: {
            name: { type: "string" },
            company: { type: ["string", "null"] },
            address: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            gstin: { type: ["string", "null"] },
            contact: { type: "string" },
          },
          required: ["name", "address", "city", "state", "contact"],
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              productId: { type: ["string", "null"], description: "unused, always null" },
              itemName: { type: "string" },
              hsnCode: { type: ["string", "null"] },
              quantity: { type: "integer", minimum: 1 },
              unitRate: {
                type: ["number", "null"],
                description: "Rate per unit. If a catalog item was clearly matched, use its unitPrice. Null if unknown.",
              },
              taxPercent: { type: "number", default: 18 },
              matchedProductSku: { type: ["string", "null"], description: "SKU from the catalog if this line clearly matches one" },
            },
            required: ["itemName", "quantity", "taxPercent"],
          },
        },
        advancePercent: { type: ["integer", "null"] },
        beforeDispatchPercent: { type: ["integer", "null"] },
        notes: { type: ["string", "null"] },
      },
      required: ["customer", "items"],
    },
  },
};

interface ExtractedItem {
  itemName: string;
  hsnCode?: string | null;
  quantity: number;
  unitRate?: number | null;
  taxPercent: number;
  matchedProductSku?: string | null;
}

interface ExtractedResult {
  customer: {
    name: string;
    company?: string | null;
    address: string;
    city: string;
    state: string;
    gstin?: string | null;
    contact: string;
  };
  items: ExtractedItem[];
  advancePercent?: number | null;
  beforeDispatchPercent?: number | null;
  notes?: string | null;
}

/** Parses a free-text chat message or voice transcript into structured quotation fields via
 * OpenAI's function-calling (forced tool_choice for reliable structured output). The result is
 * always a draft — the frontend must show it in an editable review step and the operator must
 * explicitly confirm before anything is persisted; this service never writes to the database. */
@Injectable()
export class QuotationAiParserService {
  private readonly logger = new Logger(QuotationAiParserService.name);
  private client: OpenAI | undefined;

  constructor(private readonly config: ConfigService) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.config.getOrThrow<string>("OPENAI_API_KEY");
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async parse(text: string, ctx: QuotationParseContext): Promise<QuotationDraft> {
    const model = this.config.get<string>("OPENAI_MODEL") ?? "gpt-4o";
    const catalogLines = ctx.catalog
      .slice(0, 200)
      .map((p) => `${p.sku} | ${p.name} | ${p.categoryName} | ${p.shadeName ?? "-"} | ₹${p.unitPrice}/unit`)
      .join("\n");

    const systemPrompt = `You extract structured HPL laminate quotation data from a sales operator's free-text request.
Known lead (prefill customer fields with these unless the text overrides them):
name: ${ctx.lead.name}
company: ${ctx.lead.company ?? "-"}
phone: ${ctx.lead.phone}
city: ${ctx.lead.city}
state: ${ctx.lead.state}

Product catalog (sku | name | category | shade | unit price) — match items mentioned in the text
to a real SKU/price when clearly matched; otherwise leave unitRate null and matchedProductSku null:
${catalogLines}

Always call the extract_quotation tool with your best structured extraction.`;

    let response;
    try {
      response = await this.getClient().chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        tools: [EXTRACT_TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: EXTRACT_TOOL_NAME } },
      });
    } catch (err) {
      this.logger.error(`OpenAI quotation parse failed: ${err instanceof Error ? err.message : err}`);
      throw new InternalServerErrorException("AI parsing failed — please use the manual form instead");
    }

    const toolCall = response.choices[0]?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") {
      throw new InternalServerErrorException("AI did not return structured quotation data");
    }

    let extracted: ExtractedResult;
    try {
      extracted = JSON.parse(toolCall.function.arguments) as ExtractedResult;
    } catch (err) {
      this.logger.error(`Failed to parse OpenAI tool call arguments: ${err instanceof Error ? err.message : err}`);
      throw new InternalServerErrorException("AI returned malformed quotation data");
    }

    const catalogBySku = new Map(ctx.catalog.map((p) => [p.sku, p]));

    return {
      customer: {
        name: extracted.customer.name,
        company: extracted.customer.company ?? null,
        address: extracted.customer.address,
        city: extracted.customer.city,
        state: extracted.customer.state,
        gstin: extracted.customer.gstin ?? null,
        contact: extracted.customer.contact,
      },
      items: extracted.items.map((item) => {
        const matched = item.matchedProductSku ? catalogBySku.get(item.matchedProductSku) : undefined;
        return {
          productId: matched?.id ?? null,
          itemName: item.itemName,
          hsnCode: item.hsnCode ?? null,
          quantity: item.quantity,
          unitRate: item.unitRate ?? matched?.unitPrice ?? null,
          taxPercent: item.taxPercent ?? 18,
        };
      }),
      advancePercent: extracted.advancePercent ?? null,
      beforeDispatchPercent: extracted.beforeDispatchPercent ?? null,
      notes: extracted.notes ?? null,
    };
  }
}
