export type TrendGranularity = "daily" | "weekly" | "monthly";
export type BreakdownDimension = "product" | "state" | "dealer" | "executive" | "customer";

export interface SalesOverview {
  revenue: number;
  orders: number;
  aov: number;
  growth: number | null;
  targetRevenue: number | null;
  achievement: number | null;
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
  orders: number;
  target: number | null;
}

export interface BreakdownEntry {
  id: string | null;
  name: string;
  revenue: number;
  orders: number;
}

export interface SalesTableRow {
  productId: string;
  sku: string;
  name: string;
  categoryName: string;
  units: number;
  orders: number;
  revenue: number;
  growth: number | null;
  contributionPct: number;
}
