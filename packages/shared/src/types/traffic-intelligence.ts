import { CampaignPlatform, InsightType, Priority } from '../enums';

export interface TrafficDayPoint {
  date: string;
  visitors: number;
  sessions: number;
  pageViews: number;
  newVisitors: number;
  returningVisitors: number;
  conversions: number;
  conversionRate: number | null;
  isAnomaly: boolean;
  anomalyDirection: 'up' | 'down' | null;
}

export interface TrafficChannelEntry {
  channel: string;
  sessions: number;
  conversions: number;
}

export interface TrafficDeltas {
  dayOverDay: number | null;
  weekOverWeek: number | null;
}

export interface TrafficOverview {
  series: TrafficDayPoint[];
  channelBreakdown: TrafficChannelEntry[];
  totals: {
    visitors: number;
    sessions: number;
    pageViews: number;
    conversions: number;
    conversionRate: number | null;
  };
  deltas: TrafficDeltas;
}

export type TrafficEventType = 'STATUS_CHANGED' | 'BUDGET_CHANGED' | 'NAME_CHANGED' | 'TRAFFIC_ANOMALY';

export interface TrafficTimelineEvent {
  id: string;
  type: TrafficEventType;
  occurredAt: string;
  label: string;
  campaignId: string | null;
  campaignName: string | null;
  platform: CampaignPlatform | null;
}

export interface TrafficEventDetail extends TrafficTimelineEvent {
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  trafficImpact: string | null;
  aiInterpretation: string | null;
}

export type InvestigationIntent = 'why_low' | 'why_high' | 'compare_periods' | 'recommend_campaign' | 'general';

export interface InvestigationQuery {
  question?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type CauseClassification = 'primary' | 'contributing' | 'unrelated' | 'possible';

export interface EvidenceItem {
  classification: CauseClassification;
  summary: string;
  campaignId: string | null;
  campaignName: string | null;
  metricDelta: number | null;
}

export interface CampaignRecommendationMetrics {
  conversionRate: number | null;
  costPerConversion: number | null;
  roas: number | null;
  leadsCount: number;
  ctr: number | null;
}

export interface CampaignRecommendationCandidate {
  campaignId: string;
  campaignName: string;
  score: number;
  metrics: CampaignRecommendationMetrics;
  reasonNotSelected: string | null;
}

export interface CampaignRecommendationResult {
  recommended: CampaignRecommendationCandidate | null;
  alternatives: CampaignRecommendationCandidate[];
  insufficientDataCampaigns: string[];
  recommendationText: string;
  generatedAt: string;
}

export interface TrafficInvestigationResult {
  supported: boolean;
  intent: InvestigationIntent;
  summary: string;
  trafficChange: {
    direction: 'up' | 'down' | 'flat';
    percent: number | null;
    visitorsBefore: number;
    visitorsAfter: number;
    comparedWith: string;
  };
  primaryCause: EvidenceItem | null;
  supportingEvidence: EvidenceItem[];
  contributingFactors: EvidenceItem[];
  notCausedBy: EvidenceItem[];
  recommendedAction: string;
  confidence: {
    score: number;
    label: 'High' | 'Medium' | 'Low';
  };
  recommendation?: CampaignRecommendationResult | null;
  generatedAt: string;
}

export interface ProactiveInsight {
  id: string;
  type: InsightType;
  priority: Priority;
  headline: string;
  whatHappened: string;
  whyItHappened: string;
  businessImpact: string;
  recommendedAction: string;
  confidence: number;
  generatedAt: string;
}
