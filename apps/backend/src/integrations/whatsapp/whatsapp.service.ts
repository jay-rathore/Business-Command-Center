import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { normalizeWhatsAppPhone } from "./phone.util";

interface WhatsAppMediaUploadResponse {
  id: string;
}

interface WhatsAppSendMessageResponse {
  messages: { id: string }[];
}

/** Thin wrapper around Meta's WhatsApp Cloud API (Graph API). Same native-`fetch` pattern as
 * CrmSyncService — no HTTP client module in this codebase to abstract over. Swapping from Meta's
 * free per-app test number to a client's verified business number later is a pure env-var
 * change (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN / WHATSAPP_BUSINESS_ACCOUNT_ID) —
 * no code here changes. */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    const version = this.config.get<string>("WHATSAPP_API_VERSION") ?? "v21.0";
    const phoneNumberId = this.config.getOrThrow<string>("WHATSAPP_PHONE_NUMBER_ID");
    return `https://graph.facebook.com/${version}/${phoneNumberId}`;
  }

  private get accessToken(): string {
    return this.config.getOrThrow<string>("WHATSAPP_ACCESS_TOKEN");
  }

  async uploadMedia(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

    const res = await fetch(`${this.baseUrl}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`WhatsApp media upload failed (${res.status}): ${body}`);
      throw new InternalServerErrorException("Failed to upload the quotation PDF to WhatsApp");
    }
    const data = (await res.json()) as WhatsAppMediaUploadResponse;
    return data.id;
  }

  async sendDocumentMessage(toPhone: string, mediaId: string, filename: string, caption?: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizeWhatsAppPhone(toPhone),
        type: "document",
        document: { id: mediaId, filename, caption },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`WhatsApp send failed (${res.status}): ${body}`);
      throw new InternalServerErrorException("Failed to send the quotation via WhatsApp");
    }
    const data = (await res.json()) as WhatsAppSendMessageResponse;
    return data.messages[0]?.id ?? "";
  }
}
