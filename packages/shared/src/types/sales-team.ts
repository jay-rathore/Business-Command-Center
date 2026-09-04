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
