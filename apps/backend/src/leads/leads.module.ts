import { Module } from "@nestjs/common";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";
import { LeadScoringService } from "./lead-scoring.service";
import { CrmSyncController } from "./crm-sync/crm-sync.controller";
import { CrmSyncService } from "./crm-sync/crm-sync.service";

@Module({
  controllers: [LeadsController, CrmSyncController],
  providers: [LeadsService, LeadScoringService, CrmSyncService],
  exports: [LeadsService],
})
export class LeadsModule {}
