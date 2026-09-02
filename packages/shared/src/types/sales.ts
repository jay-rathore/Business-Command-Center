import { SalesTargetScope, TargetPeriodType } from '../enums';

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

export interface SalesTargetItem {
  id: string;
  scope: SalesTargetScope;
  salesExecutiveId: string | null;
  salesExecutiveName: string | null;
  dealerId: string | null;
  dealerName: string | null;
  productCategoryId: string | null;
  productCategoryName: string | null;
  periodType: TargetPeriodType;
  periodStart: string;
  periodEnd: string;
  targetRevenue: number;
  targetOrders: number | null;
  achievedRevenue: number;
  achievedOrders: number | null;
  achievementPct: number | null;
}

export interface UpsertSalesTargetRequest {
  scope: SalesTargetScope;
  salesExecutiveId?: string;
  dealerId?: string;
  productCategoryId?: string;
  periodType: TargetPeriodType;
  periodStart: string;
  periodEnd: string;
  targetRevenue: number;
  targetOrders?: number;
}
