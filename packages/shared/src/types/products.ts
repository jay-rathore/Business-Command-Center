export type DemandTier = "High" | "Medium" | "Low";

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  shadeId: string | null;
  shadeName: string | null;
  design: string | null;
  unitPrice: number;
  units: number;
  orders: number;
  revenue: number;
  growth: number | null;
  demandTier: DemandTier;
}

export interface ProductStateDemand {
  state: string;
  units: number;
  pct: number;
}

export interface ProductDetail extends ProductListItem {
  demandByState: ProductStateDemand[];
}

export interface ProductCategoryOption {
  id: string;
  name: string;
}

export interface ProductShadeOption {
  id: string;
  name: string;
}

export interface TopEntry {
  name: string;
  value: number;
  pctOfTotal: number;
}

export interface ProductsStatSummary {
  totalSkus: number;
  unitsSold: number;
  totalOrders: number;
  totalRevenue: number;
  avgGrowth: number | null;
  bestSellingShade: TopEntry | null;
  bestSellingDesign: TopEntry | null;
  highestDemandCategory: TopEntry | null;
}

export interface CategoryBreakdownEntry {
  categoryId: string;
  categoryName: string;
  skuCount: number;
  units: number;
  revenue: number;
}
