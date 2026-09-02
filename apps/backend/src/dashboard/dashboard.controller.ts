import { Controller, Get, Query } from "@nestjs/common";
import type { ContributorTab } from "@hpl/shared";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { DateRangeQueryDto } from "../common/dto/date-range-query.dto";
import { DashboardService } from "./dashboard.service";
import { BusinessHealthService } from "./business-health.service";
import { AttentionFeedService } from "./attention-feed.service";
import { ContributorsService } from "./contributors.service";

@Controller("dashboard")
@RequirePermission("dashboard:read")
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly businessHealth: BusinessHealthService,
    private readonly attentionFeed: AttentionFeedService,
    private readonly contributors: ContributorsService,
  ) {}

  @Get("summary")
  getSummary(@Query() query: DateRangeQueryDto) {
    return this.dashboardService.getSummary(query.dateFrom, query.dateTo);
  }

  @Get("business-health")
  getBusinessHealth() {
    return this.businessHealth.getSignals();
  }

  @Get("attention")
  getAttention() {
    return this.attentionFeed.getFeed();
  }

  @Get("contributors")
  getContributors(@Query("tab") tab: ContributorTab = "dealers") {
    return this.contributors.getContributors(tab);
  }

  @Get("ai-summary")
  getAiSummary() {
    return this.dashboardService.getAiSummary();
  }
}
