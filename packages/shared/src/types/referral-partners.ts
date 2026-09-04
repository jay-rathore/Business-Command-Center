export interface ReferralPartnerListItem {
  id: string;
  name: string;
  company: string | null;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  joinedAt: string | null;
  lastActivityAt: string | null;
  projectsReferred: number;
  leadsReferred: number;
  sampleRequestsSent: number;
  projectValue: number;
  revenueInfluenced: number;
}

export interface ReferralPartnerKpis {
  total: number;
  newThisMonth: number;
  projectsReferred: number;
  leadsReferred: number;
  sampleRequestsSent: number;
  projectValue: number;
  revenueInfluenced: number;
}

export interface ReferralPartnerLeaderboardEntry {
  id: string;
  name: string;
  projects: number;
  projectValue: number;
  revenueInfluenced: number;
}

export interface RecentReferralItem {
  id: string;
  projectName: string;
  partnerName: string;
  stage: string;
  estimatedValue: number;
  createdAt: string;
}
