export type HealthStatus = "good" | "warn" | "crit" | "pending";

export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  format: "currency" | "number" | "percent";
  delta: number | null;
  status: HealthStatus;
}

export interface DashboardSummary {
  revenue: DashboardKpi;
  orders: DashboardKpi;
  targetAchievement: DashboardKpi;
  pipelineValue: DashboardKpi;
  newLeads: DashboardKpi;
  conversionRate: DashboardKpi;
}

export interface BusinessHealthSignal {
  key: string;
  name: string;
  status: HealthStatus;
  description: string;
}

export type AttentionPriority = "critical" | "high" | "medium";

export interface AttentionItem {
  id: string;
  priority: AttentionPriority;
  title: string;
  meta: string;
  value: number | null;
  module: string;
  recordId: string | null;
}

export type ContributorTab = "dealers" | "products" | "states" | "executives" | "projects";

export interface ContributorEntry {
  id: string | null;
  name: string;
  value: number;
}

export interface AiExecutiveSummary {
  narrative: string;
  recommendedActions: string[];
  generatedAt: string;
}
