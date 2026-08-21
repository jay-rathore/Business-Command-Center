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
  stage: LeadStatusOption;
  label: string;
  count: number;
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
