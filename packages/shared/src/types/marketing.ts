import { CampaignPlatform, CampaignStatus } from '../enums';

export type CampaignSource = 'live' | 'demo';

export interface CampaignListItem {
  id: string;
  name: string;
  platform: CampaignPlatform;
  status: CampaignStatus;
  spend: number;
  leadsCount: number;
  revenue: number;
  cpl: number | null;
  roas: number | null;
  impressions: number;
  clicks: number;
  ctr: number | null;
  avgCpc: number | null;
  conversionRate: number | null;
  dailyBudget: number | null;
  bidStrategy: string | null;
  source: CampaignSource;
  startDate: string;
  endDate: string | null;
}

export interface CampaignDetail extends CampaignListItem {
  notes: string | null;
}

export interface MarketingKpis {
  totalSpend: number;
  totalLeads: number;
  blendedCpl: number | null;
  activeCampaigns: number;
  campaignsByPlatform: Record<CampaignPlatform, number>;
  // Computed over demo-source campaigns only — never blended with real Meta spend, which has
  // no revenue data yet (see the "never fabricate revenue against real spend" note in
  // marketing.service.ts).
  demoRevenue: number;
  blendedRoas: number | null;
}

export interface ChannelBreakdownEntry {
  platform: CampaignPlatform;
  spend: number;
  leadsCount: number;
  campaignCount: number;
}

export interface SiteAnalyticsSummary {
  totals: {
    sessions: number;
    activeUsers: number;
    newUsers: number;
    pageViews: number;
    conversions: number;
  };
  series: Array<{ date: string; sessions: number; activeUsers: number; conversions: number }>;
}

export interface SearchConsoleSummary {
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  series: Array<{ date: string; clicks: number; impressions: number }>;
  topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
}
