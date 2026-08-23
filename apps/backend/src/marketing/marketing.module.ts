import { Module } from '@nestjs/common';
import { IntegrationConnectionsModule } from '../integration-connections/integration-connections.module';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { MetaAdsSyncController } from './meta-ads-sync/meta-ads-sync.controller';
import { MetaAdsSyncService } from './meta-ads-sync/meta-ads-sync.service';
import { GoogleAdsSyncController } from './google-ads-sync/google-ads-sync.controller';
import { GoogleAdsSyncService } from './google-ads-sync/google-ads-sync.service';
import { GoogleAnalyticsSyncController } from './google-analytics-sync/google-analytics-sync.controller';
import { GoogleAnalyticsSyncService } from './google-analytics-sync/google-analytics-sync.service';
import { SearchConsoleSyncController } from './search-console-sync/search-console-sync.controller';
import { SearchConsoleSyncService } from './search-console-sync/search-console-sync.service';
import { CampaignEventService } from './campaign-events/campaign-event.service';
import { TrafficIntelligenceController } from './traffic-intelligence/traffic-intelligence.controller';
import { TrafficIntelligenceService } from './traffic-intelligence/traffic-intelligence.service';
import { RootCauseEngineService } from './traffic-intelligence/root-cause-engine.service';
import { InvestigationQueryParserService } from './traffic-intelligence/investigation-query-parser.service';
import {
  RuleBasedTrafficNarrativeComposer,
  OpenAiTrafficNarrativeComposer,
} from './traffic-intelligence/narrative-composer.service';
import { TRAFFIC_NARRATIVE_COMPOSER } from './traffic-intelligence/traffic-narrative.port';

@Module({
  imports: [IntegrationConnectionsModule],
  // MarketingController must be registered last — its GET /api/marketing/:id route would
  // otherwise swallow the sibling controllers' literal GET /api/marketing/google-analytics-sync
  // and GET /api/marketing/search-console-sync routes (Nest/Express match routes in
  // registration order, and a wildcard segment like :id matches any literal path segment too).
  controllers: [
    MetaAdsSyncController,
    GoogleAdsSyncController,
    GoogleAnalyticsSyncController,
    SearchConsoleSyncController,
    TrafficIntelligenceController,
    MarketingController,
  ],
  providers: [
    MarketingService,
    MetaAdsSyncService,
    GoogleAdsSyncService,
    GoogleAnalyticsSyncService,
    SearchConsoleSyncService,
    CampaignEventService,
    TrafficIntelligenceService,
    RootCauseEngineService,
    InvestigationQueryParserService,
    OpenAiTrafficNarrativeComposer,
    {
      provide: TRAFFIC_NARRATIVE_COMPOSER,
      useClass: RuleBasedTrafficNarrativeComposer,
    },
  ],
})
export class MarketingModule {}
