import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";
import { LeadScoringService } from "./lead-scoring.service";
import { BusinessCardAiParserService } from "./business-card-ai-parser.service";
import { BusinessCardImageService } from "./business-card-image.service";
import { LeadCodingService } from "./lead-coding.service";
import { CrmSyncController } from "./crm-sync/crm-sync.controller";
import { CrmSyncService } from "./crm-sync/crm-sync.service";

@Module({
  imports: [NotificationsModule],
  controllers: [LeadsController, CrmSyncController],
  providers: [
    LeadsService,
    LeadScoringService,
    BusinessCardAiParserService,
    BusinessCardImageService,
    LeadCodingService,
    CrmSyncService,
  ],
  exports: [LeadsService],
})
export class LeadsModule {}
