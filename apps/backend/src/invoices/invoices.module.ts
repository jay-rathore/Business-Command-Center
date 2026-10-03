import { Module } from "@nestjs/common";
import { LeadsModule } from "../leads/leads.module";
import { CompanyProfilesModule } from "../company-profiles/company-profiles.module";
import { WhatsAppModule } from "../integrations/whatsapp/whatsapp.module";
import { EmailModule } from "../integrations/email/email.module";
import { IntegrationConnectionsModule } from "../integration-connections/integration-connections.module";
import { QuotationsModule } from "../quotations/quotations.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { InvoiceNumberingService } from "./invoice-numbering.service";
import { InvoicePdfService } from "./invoice-pdf.service";

@Module({
  imports: [LeadsModule, CompanyProfilesModule, WhatsAppModule, EmailModule, IntegrationConnectionsModule, QuotationsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceNumberingService, InvoicePdfService],
})
export class InvoicesModule {}
