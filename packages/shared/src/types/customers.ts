import { CustomerType } from '../enums';

export type CustomerSegment = 'NEW' | 'ACTIVE' | 'AT_RISK' | 'DORMANT';

export interface CustomerListItem {
  id: string;
  customerCode: string;
  name: string;
  companyName: string | null;
  type: CustomerType;
  phone: string;
  city: string;
  state: string;
  lifetimeValue: number;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  segment: CustomerSegment;
  totalOrders: number;
}

export interface CustomerOrderSummary {
  id: string;
  orderCode: string;
  orderDate: string;
  status: string;
  totalAmount: number;
}

export interface CustomerComplaintSummary {
  id: string;
  complaintCode: string;
  issue: string;
  status: string;
  createdAt: string;
}

export interface CustomerWarrantyClaimSummary {
  id: string;
  claimCode: string;
  status: string;
  claimDate: string;
}

export interface CustomerDetail extends CustomerListItem {
  email: string | null;
  address: string | null;
  notes: string | null;
  satisfactionScore: number | null;
  openComplaints: number;
  activeWarrantyClaims: number;
  recentOrders: CustomerOrderSummary[];
  recentComplaints: CustomerComplaintSummary[];
  recentWarrantyClaims: CustomerWarrantyClaimSummary[];
}

export interface CustomersKpis {
  totalCustomers: number;
  newThisMonth: number;
  totalLifetimeValue: number;
  avgLifetimeValue: number;
  activeCustomers: number;
  atRiskCustomers: number;
  dormantCustomers: number;
  openComplaints: number;
  activeWarrantyClaims: number;
}

export interface CustomerLeaderboardEntry {
  id: string;
  name: string;
  lifetimeValue: number;
  totalOrders: number;
  segment: CustomerSegment;
}
