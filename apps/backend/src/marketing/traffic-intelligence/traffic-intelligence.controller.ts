import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { TrafficIntelligenceService } from './traffic-intelligence.service';
import { InvestigateTrafficDto } from './dto/investigate-traffic.dto';

@Controller('marketing/traffic-intelligence')
@RequirePermission('marketing:read')
export class TrafficIntelligenceController {
  constructor(
    private readonly trafficIntelligence: TrafficIntelligenceService,
  ) {}

  @Get('overview')
  getOverview(@Query() query: DateRangeQueryDto) {
    return this.trafficIntelligence.getOverview(query.dateFrom, query.dateTo);
  }

  @Get('timeline')
  getTimeline(@Query() query: DateRangeQueryDto) {
    return this.trafficIntelligence.getTimeline(query.dateFrom, query.dateTo);
  }

  @Get('events/:id')
  getEventDetail(@Param('id') id: string) {
    return this.trafficIntelligence.getEventDetail(id);
  }

  @Post('investigate')
  investigate(@Body() body: InvestigateTrafficDto) {
    return this.trafficIntelligence.investigate(body);
  }

  @Get('proactive-insights')
  getProactiveInsights() {
    return this.trafficIntelligence.getProactiveInsights();
  }

  /** On-demand digest run for testing — the @Cron in ProactiveInsightsService already runs this
   * daily for every tenant with GA4 connected. Mirrors MetaAdsSyncController's "/run" pattern. */
  @Post('proactive-insights/run')
  @RequirePermission('marketing:manage')
  runProactiveInsightsDigest() {
    return this.trafficIntelligence.runProactiveInsightsDigest();
  }
}
