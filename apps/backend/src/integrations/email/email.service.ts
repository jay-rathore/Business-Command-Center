import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, Transporter } from "nodemailer";

/** Generic SMTP mailer — works with any provider (Gmail + App Password, Office365, a business
 * mailbox, or a transactional-email SMTP relay) rather than locking into one vendor's API, since
 * this channel exists specifically to be usable immediately without waiting on WhatsApp Business
 * verification. */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | undefined;

  constructor(private readonly config: ConfigService) {}

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = createTransport({
        host: this.config.getOrThrow<string>("EMAIL_SMTP_HOST"),
        port: Number(this.config.get<string>("EMAIL_SMTP_PORT") ?? "587"),
        secure: this.config.get<string>("EMAIL_SMTP_SECURE") === "true",
        auth: {
          user: this.config.getOrThrow<string>("EMAIL_SMTP_USER"),
          pass: this.config.getOrThrow<string>("EMAIL_SMTP_PASS"),
        },
      });
    }
    return this.transporter;
  }

  async sendQuotationEmail(params: {
    to: string;
    subject: string;
    bodyText: string;
    attachmentBuffer: Buffer;
    attachmentFilename: string;
  }): Promise<void> {
    const fromAddress = this.config.getOrThrow<string>("EMAIL_FROM_ADDRESS");
    const fromName = this.config.get<string>("EMAIL_FROM_NAME") ?? "HPL Maker";

    try {
      await this.getTransporter().sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: params.to,
        subject: params.subject,
        text: params.bodyText,
        attachments: [{ filename: params.attachmentFilename, content: params.attachmentBuffer, contentType: "application/pdf" }],
      });
    } catch (err) {
      this.logger.error(`Email send failed: ${err instanceof Error ? err.message : err}`);
      throw new InternalServerErrorException("Failed to send the quotation via email");
    }
  }
}
