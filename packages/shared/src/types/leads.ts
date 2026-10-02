import { ActivityType, LeadStage } from "../enums";

export interface LeadStatusOption {
  id: string;
  name: string;
  stage: LeadStage;
  sortOrder: number;
}

export interface LeadSourceOption {
  id: string;
  name: string;
}

export interface LeadTypeOption {
  id: string;
  name: string;
}

export interface LeadListItem {
  id: string;
  leadCode: string;
  name: string;
  company: string | null;
  phone: string;
  email: string | null;
  sources: LeadSourceOption[];
  state: string;
  city: string;
  leadType: LeadTypeOption | null;
  assignedExecName: string | null;
  status: LeadStatusOption | null;
  score: number;
  estimatedValue: number | null;
  nextFollowUpAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  isOverdue: boolean;
}

export interface LeadActivityItem {
  id: string;
  type: ActivityType;
  note: string | null;
  performedByName: string | null;
  occurredAt: string;
}

export interface LeadDetail extends LeadListItem {
  notes: string | null;
  lostReason: string | null;
  address: string | null;
  website: string | null;
  hasBusinessCardImage: boolean;
  activities: LeadActivityItem[];
}

export interface LeadOutcomeBucket {
  key: string;
  label: string;
  count: number;
  pctOfTotal: number;
  /** Set on the Won / Lost buckets so the UI can filter the leads table to them. */
  stage?: "WON" | "LOST";
  /** The CRM statuses inside this bucket (for Lost these are the lost reasons), biggest first. */
  statuses: { name: string; count: number }[];
}

export interface LeadOutcomeRate {
  key: string;
  label: string;
  /** Percent, 0-100; null when the denominator is 0. */
  value: number | null;
  description: string;
}

export interface LeadOutcomes {
  total: number;
  /** Mutually exclusive — the counts add up to `total`. */
  buckets: LeadOutcomeBucket[];
  rates: LeadOutcomeRate[];
}

export type SourceRating = "strong" | "average" | "weak" | "low_volume" | "unworked";

export interface LeadSourcePerformanceRow {
  source: string;
  /** null for the "No source recorded" row. */
  sourceId: string | null;
  /** A lead with several sources counts once under each, so rows can add up to more than the total. */
  leads: number;
  worked: number;
  /** Interested + Qualified + Won. */
  interested: number;
  won: number;
  lost: number;
  contactRate: number | null;
  interestRate: number | null;
  lostRate: number | null;
  /** Won / (Won + Lost). */
  winRate: number | null;
  topLostReason: string | null;
  rating: SourceRating;
}

export interface LeadSourcePerformance {
  /** Whole-pipeline rates the ratings are judged against. */
  baseline: { contactRate: number | null; interestRate: number | null; lostRate: number | null; winRate: number | null };
  /** Sources with fewer leads than this are rated "low_volume" instead of strong/weak. */
  minLeads: number;
  sources: LeadSourcePerformanceRow[];
}

export interface LeadsKpis {
  totalLeads: number;
  newThisMonth: number;
  qualified: number;
  pending: number;
  won: number;
  lost: number;
  conversionRate: number;
}

export interface FunnelStage {
  label: string;
  /** Leads currently at this stage or any later one (plus, for the first bar, every lead in range). */
  count: number;
  /** The CRM status names grouped into this stage — empty for the "All leads" bar. */
  statuses: string[];
}

export interface SourceBreakdownEntry {
  source: LeadSourceOption;
  count: number;
}

export interface ExecutiveOption {
  id: string;
  name: string;
}

/** Structured fields extracted from a photographed/uploaded business card via OpenAI vision.
 * Always a draft — the frontend must show it in an editable review step before a Lead is
 * created; the extraction endpoint itself never writes to the database. */
export interface BusinessCardDraft {
  name: string;
  company: string | null;
  phone: string;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

export interface DuplicateLeadMatch {
  id: string;
  name: string;
  leadCode: string;
  matchedOn: "phone" | "email";
}

export interface CreateLeadFromCardRequest {
  name: string;
  company?: string | null;
  phone: string;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  state: string;
  city: string;
  leadTypeId?: string | null;
  assignedExecId?: string | null;
  statusId?: string | null;
  notes?: string | null;
  saveImage: boolean;
  imageDataUrl?: string | null;
}
