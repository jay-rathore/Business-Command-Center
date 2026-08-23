import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { normalizeWhatsAppPhone } from "./phone.util";
import type { WhatsAppCredentials } from "../../integration-connections/credential-types";

interface WhatsAppMediaUploadResponse {
  id: string;
}

interface WhatsAppSendMessageResponse {
  messages: { id: string }[];
}

/** Thin wrapper around Meta's WhatsApp Cloud API (Graph API). Same native-`fetch` pattern as
 * CrmSyncService — no HTTP client module in this codebase to abstract over. Credentials are
 * per-tenant (IntegrationConnection, provider WHATSAPP) and passed in by the caller — this
 * service itself is stateless so it can't accidentally cache one tenant's token. */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  private baseUrl(credentials: WhatsAppCredentials): string {
    return `https://graph.facebook.com/${credentials.apiVersion ?? "v21.0"}/${credentials.phoneNumberId}`;
  }

  async uploadMedia(
    credentials: WhatsAppCredentials,
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

    const res = await fetch(`${this.baseUrl(credentials)}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
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

  async sendDocumentMessage(
    credentials: WhatsAppCredentials,
    toPhone: string,
    mediaId: string,
    filename: string,
    caption?: string,
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl(credentials)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
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
