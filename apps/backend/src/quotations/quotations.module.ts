import { Module } from "@nestjs/common";
import { LeadsModule } from "../leads/leads.module";
import { CompanyProfilesModule } from "../company-profiles/company-profiles.module";
import { WhatsAppModule } from "../integrations/whatsapp/whatsapp.module";
import { EmailModule } from "../integrations/email/email.module";
import { QuotationsController } from "./quotations.controller";
import { QuotationsService } from "./quotations.service";
import { QuotationNumberingService } from "./quotation-numbering.service";
import { QuotationAiParserService } from "./quotation-ai-parser.service";
import { QuotationPdfService } from "./quotation-pdf.service";

@Module({
  imports: [LeadsModule, CompanyProfilesModule, WhatsAppModule, EmailModule],
  controllers: [QuotationsController],
  providers: [QuotationsService, QuotationNumberingService, QuotationAiParserService, QuotationPdfService],
})
export class QuotationsModule {}
