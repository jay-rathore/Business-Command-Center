import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { createTransport } from "nodemailer";
import type { EmailSmtpCredentials } from "../../integration-connections/credential-types";

/** Generic SMTP mailer — works with any provider (Gmail + App Password, Office365, a business
 * mailbox, or a transactional-email SMTP relay) rather than locking into one vendor's API.
 * Credentials are per-tenant (IntegrationConnection, provider EMAIL_SMTP) and passed in by the
 * caller — deliberately not cached on the instance (this is a singleton provider shared across
 * every tenant's requests, so caching one tenant's transporter would leak it to the next). */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendQuotationEmail(
    credentials: EmailSmtpCredentials,
    params: {
      to: string;
      subject: string;
      bodyText: string;
      attachmentBuffer: Buffer;
      attachmentFilename: string;
    },
  ): Promise<void> {
    const transporter = createTransport({
      host: credentials.host,
      port: credentials.port,
      secure: credentials.secure,
      auth: { user: credentials.user, pass: credentials.pass },
    });
    const fromName = credentials.fromName ?? credentials.fromAddress;

    try {
      await transporter.sendMail({
        from: `"${fromName}" <${credentials.fromAddress}>`,
        to: params.to,
        subject: params.subject,
        text: params.bodyText,
        attachments: [
          { filename: params.attachmentFilename, content: params.attachmentBuffer, contentType: "application/pdf" },
        ],
      });
    } catch (err) {
      this.logger.error(`Email send failed: ${err instanceof Error ? err.message : err}`);
      throw new InternalServerErrorException("Failed to send the quotation via email");
    }
  }
}
