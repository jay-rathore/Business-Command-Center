import { DealerStatus } from "../enums";

export interface DealerHealthFactor {
  label: string;
  score: number;
}

export interface DealerHealthBreakdown {
  orderFrequency: DealerHealthFactor & { orderCount: number };
  revenue: DealerHealthFactor & { trailing30dRevenue: number };
  recentActivity: DealerHealthFactor & { daysSinceLastOrder: number | null };
  growth: DealerHealthFactor & { growthPct: number | null };
  recency: DealerHealthFactor & { tenureYears: number };
}

export interface DealerListItem {
  id: string;
  dealerCode: string;
  name: string;
  contactName: string | null;
  city: string;
  state: string;
  status: DealerStatus;
  managerName: string | null;
  joinedAt: string;
  lastOrderAt: string | null;
  totalOrders: number;
  revenue: number;
  growth: number | null;
  healthScore: number | null;
}

export interface DealerDetail extends DealerListItem {
  phone: string;
  email: string | null;
  address: string | null;
  healthScoreBreakdown: DealerHealthBreakdown | null;
  healthScoreUpdatedAt: string | null;
}

export interface DealersKpis {
  totalDealers: number;
  activeDealers: number;
  newDealers: number;
  atRiskDealers: number;
  inactiveDealers: number;
  networkRevenue: number;
  avgHealthScore: number | null;
  orderGrowth: number | null;
}

export interface DealerLeaderboardEntry {
  id: string;
  name: string;
  healthScore: number | null;
  totalOrders: number;
  revenue: number;
}
