import type { LeadOutcomeRate, LeadOutcomes, LeadSourcePerformance } from "./leads";

export interface SalesTeamExecutive {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  state: string | null;
  managerName: string | null;
  revenue: number;
  orders: number;
  leadsAssigned: number;
  leadsWon: number;
  conversionRate: number | null;
  targetRevenue: number | null;
  achievementPct: number | null;
  overdueFollowUps: number;
}

export interface SalesTeamKpis {
  activeExecutives: number;
  teamRevenue: number;
  teamTargetRevenue: number | null;
  teamAchievement: number | null;
  overdueFollowUps: number;
}

export interface SalesTeamLeaderboardEntry {
  id: string;
  name: string;
  designation: string;
  revenue: number;
  orders: number;
  achievementPct: number | null;
}

export interface FollowUpRiskLead {
  id: string;
  leadCode: string;
  name: string;
  company: string | null;
  execId: string | null;
  execName: string | null;
  statusName: string | null;
  estimatedValue: number | null;
  nextFollowUpAt: string;
  daysOverdue: number;
}

// ── Per-executive drill-down (Sales Team → click an executive) ──────────────────────────────────

export interface ExecutiveProfile {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  state: string | null;
  email: string | null;
  phone: string | null;
  managerName: string | null;
  hireDate: string | null;
  status: string;
}

export interface ExecutiveLeadStats {
  /** Leads assigned to this executive (created in the selected range). */
  total: number;
  /** Still in a "New" status — not worked yet. */
  untouched: number;
  /** Anything past New, lost included. */
  worked: number;
  /** Interested + Qualified + Won. */
  interested: number;
  won: number;
  lost: number;
  /** Open leads whose next follow-up date has passed (all time, not range-limited). */
  overdueFollowUps: number;
  /** Open leads with a follow-up due in the next 7 days. */
  upcomingFollowUps: number;
}

export interface ExecutiveMonthPoint {
  /** YYYY-MM */
  month: string;
  /** Leads assigned to the executive that were created this month. */
  assigned: number;
  /** Leads that reached Won this month. */
  won: number;
  /** Leads that were marked Lost this month. */
  lost: number;
}

export interface ExecutiveRevenue {
  revenue: number;
  orders: number;
  avgOrderValue: number | null;
  targetRevenue: number | null;
  achievementPct: number | null;
}

export interface ExecutiveRecentOrder {
  id: string;
  orderCode: string;
  orderDate: string;
  status: string;
  totalAmount: number;
}

export interface ExecutiveProjects {
  total: number;
  pipelineValue: number;
  byStage: { stage: string; count: number; value: number }[];
}

export interface ExecutiveDocuments {
  quotations: { count: number; value: number };
  invoices: { count: number; value: number };
}

export interface ExecutiveActivity {
  total: number;
  byType: { type: string; count: number }[];
  recent: { id: string; type: string; note: string | null; occurredAt: string; leadId: string; leadName: string }[];
}

export interface ExecutiveOverdueLead {
  id: string;
  leadCode: string;
  name: string;
  company: string | null;
  statusName: string | null;
  estimatedValue: number | null;
  nextFollowUpAt: string;
  daysOverdue: number;
}

export interface ExecutiveOverview {
  executive: ExecutiveProfile;
  lead: ExecutiveLeadStats;
  /** The executive's own outcome buckets (they add up to lead.total) and rates. */
  outcomes: LeadOutcomes;
  /** The same rates across the whole team, for comparison. */
  teamRates: LeadOutcomeRate[];
  /** Per lead source: how this executive's leads from each source turned out. */
  sources: LeadSourcePerformance;
  monthly: ExecutiveMonthPoint[];
  revenue: ExecutiveRevenue;
  recentOrders: ExecutiveRecentOrder[];
  projects: ExecutiveProjects;
  documents: ExecutiveDocuments;
  activity: ExecutiveActivity;
  overdueLeads: ExecutiveOverdueLead[];
}
