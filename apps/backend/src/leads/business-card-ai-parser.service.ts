import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { BusinessCardDraft } from "@hpl/shared";

const EXTRACT_TOOL_NAME = "extract_business_card";

const EXTRACT_TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: EXTRACT_TOOL_NAME,
    description: "Extract contact details visible on a scanned/photographed business card image.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Person's full name" },
        company: { type: ["string", "null"] },
        phone: { type: "string", description: "Primary phone number, as printed" },
        email: { type: ["string", "null"] },
        website: { type: ["string", "null"] },
        address: { type: ["string", "null"], description: "Full postal address as printed" },
        city: { type: ["string", "null"], description: "City parsed out of the address, if identifiable" },
        state: { type: ["string", "null"], description: "State parsed out of the address, if identifiable" },
      },
      required: ["name", "phone"],
    },
  },
};

interface ExtractedCard {
  name: string;
  company?: string | null;
  phone: string;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

const SYSTEM_PROMPT = `You extract contact details from a photographed or scanned business card image.
If a field is not visible or not present on the card, return null for it — except name and phone,
which you must do your best to infer even if partially obscured. Always call the extract_business_card tool.`;

/** Parses a business card image into structured contact fields via OpenAI vision + forced
 * function-calling. Mirrors QuotationAiParserService's shape: the result is always a draft —
 * the frontend must show it in an editable review step and the operator must explicitly confirm
 * before anything is persisted; this service never writes to the database. */
@Injectable()
export class BusinessCardAiParserService {
  private readonly logger = new Logger(BusinessCardAiParserService.name);
  private client: OpenAI | undefined;

  constructor(private readonly config: ConfigService) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.config.getOrThrow<string>("OPENAI_API_KEY");
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async parse(imageDataUrl: string): Promise<BusinessCardDraft> {
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(imageDataUrl)) {
      throw new InternalServerErrorException("Invalid image data");
    }

    const model = this.config.get<string>("OPENAI_MODEL") ?? "gpt-4o";

    let response;
    try {
      response = await this.getClient().chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the contact details from this business card." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        tools: [EXTRACT_TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: EXTRACT_TOOL_NAME } },
      });
    } catch (err) {
      this.logger.error(`OpenAI business card scan failed: ${err instanceof Error ? err.message : err}`);
      throw new InternalServerErrorException("Card scan failed — please enter details manually");
    }

    const toolCall = response.choices[0]?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") {
      throw new InternalServerErrorException("AI did not return structured card data");
    }

    let extracted: ExtractedCard;
    try {
      extracted = JSON.parse(toolCall.function.arguments) as ExtractedCard;
    } catch (err) {
      this.logger.error(`Failed to parse OpenAI tool call arguments: ${err instanceof Error ? err.message : err}`);
      throw new InternalServerErrorException("AI returned malformed card data");
    }

    return {
      name: extracted.name,
      company: extracted.company ?? null,
      phone: extracted.phone,
      email: extracted.email ?? null,
      website: extracted.website ?? null,
      address: extracted.address ?? null,
      city: extracted.city ?? null,
      state: extracted.state ?? null,
    };
  }
}
