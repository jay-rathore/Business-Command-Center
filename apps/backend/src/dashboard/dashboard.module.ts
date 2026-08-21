import { Module } from "@nestjs/common";
import { SalesModule } from "../sales/sales.module";
import { LeadsModule } from "../leads/leads.module";
import { DealersModule } from "../dealers/dealers.module";
import { ProjectsModule } from "../projects/projects.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { BusinessHealthService } from "./business-health.service";
import { AttentionFeedService } from "./attention-feed.service";
import { ContributorsService } from "./contributors.service";
import { INSIGHT_GENERATOR, RuleBasedInsightGenerator } from "./ai-summary.service";

@Module({
  imports: [SalesModule, LeadsModule, DealersModule, ProjectsModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    BusinessHealthService,
    AttentionFeedService,
    ContributorsService,
    { provide: INSIGHT_GENERATOR, useClass: RuleBasedInsightGenerator },
  ],
})
export class DashboardModule {}
