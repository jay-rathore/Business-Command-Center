import { LeadStage } from "@prisma/client";

/**
 * The HPL CRM's LeadStatus rows are free-text, staff-editable, and department-scoped —
 * the same status *name* can legitimately appear more than once with different CRM ids
 * (e.g. "New Lead" appears under 4 different ids, "Hot Followup" under 2). Since our
 * LeadStatus.name is globally unique, duplicates by name are collapsed into one row at
 * import time; every CRM id that shares a name resolves to that same row.
 *
 * This table is the reviewed, best-guess WON/LOST/OPEN classification from the schema
 * migration plan — editable later via the `stage`/`sortOrder` columns without a migration.
 * Any status name not listed here (a brand new one added in the CRM after this was written)
 * falls back to OPEN/sortOrder 0 rather than being silently mis-classified.
 */
export const CRM_STATUS_CLASSIFICATION: Record<string, { stage: LeadStage; sortOrder: number }> = {
  // WON
  Won: { stage: "WON", sortOrder: 100 },
  "Sales Done": { stage: "WON", sortOrder: 100 },

  // LOST
  "Not Interested": { stage: "LOST", sortOrder: 0 },
  Declined: { stage: "LOST", sortOrder: 0 },
  "Wrong Number": { stage: "LOST", sortOrder: 0 },
  "Already Purchased": { stage: "LOST", sortOrder: 0 },
  "No Requirement": { stage: "LOST", sortOrder: 0 },
  Lost: { stage: "LOST", sortOrder: 0 },

  // OPEN — ordered roughly by pipeline progression, drives the funnel chart
  New: { stage: "OPEN", sortOrder: 10 },
  "New Lead": { stage: "OPEN", sortOrder: 10 },
  Incoming: { stage: "OPEN", sortOrder: 15 },
  Open: { stage: "OPEN", sortOrder: 15 },
  International: { stage: "OPEN", sortOrder: 20 },
  Answered: { stage: "OPEN", sortOrder: 20 },
  Contacted: { stage: "OPEN", sortOrder: 30 },
  Callback: { stage: "OPEN", sortOrder: 35 },
  "No Answer": { stage: "OPEN", sortOrder: 35 },
  Busy: { stage: "OPEN", sortOrder: 35 },
  Missed: { stage: "OPEN", sortOrder: 35 },
  "Switched-Off/Unavailable": { stage: "OPEN", sortOrder: 35 },
  Disconnected: { stage: "OPEN", sortOrder: 35 },
  "Language Barrier": { stage: "OPEN", sortOrder: 35 },
  Followup: { stage: "OPEN", sortOrder: 45 },
  "Late Requirement": { stage: "OPEN", sortOrder: 45 },
  "Hot Followup": { stage: "OPEN", sortOrder: 50 },
  Interested: { stage: "OPEN", sortOrder: 55 },
  "Hot Lead": { stage: "OPEN", sortOrder: 60 },
  Qualified: { stage: "OPEN", sortOrder: 65 },

  // Data-entry junk in the CRM (not real statuses) — mirrored per "don't lose data", low priority.
  Fd: { stage: "OPEN", sortOrder: 5 },
  Dsf: { stage: "OPEN", sortOrder: 5 },
  H: { stage: "OPEN", sortOrder: 5 },
  Jan: { stage: "OPEN", sortOrder: 5 },
};

/** Statuses that exist in the CRM but are not part of the sales pipeline: the hiring statuses staff
 * sometimes mis-apply to sales leads (the CRM tags only some copies of them as department "Hr", and a
 * lead's own status carries no department, so the department check can't catch them) and data-entry
 * junk. The leads keep their status and still count in totals — the status is just hidden from the
 * funnel and from the status pickers (LeadStatus.isActive = false). */
export const HIDDEN_STATUS_NAMES = new Set(["Applied", "Screening", "Offer Sent", "Rejected", "Hired", "Fd", "Dsf", "H", "Jan"]);

/** The funnel groups the pipeline statuses into stages by sortOrder tier. A lead's position is its
 * CURRENT status (the CRM keeps no status history), so each bar reads "leads now at this stage or
 * later". Statuses in the same tier are one stage — their relative order is not meaningful. */
export const FUNNEL_STAGES: { label: string; sortOrders: number[] }[] = [
  { label: "New", sortOrders: [10, 15] },
  { label: "Contacted", sortOrders: [20, 30] },
  { label: "Call attempted", sortOrders: [35] },
  { label: "Follow-up", sortOrders: [45, 50] },
  { label: "Interested", sortOrders: [55, 60] },
  { label: "Qualified", sortOrders: [65] },
  { label: "Won", sortOrders: [100] },
];

/** HR-department statuses (Offer Sent/Rejected/Hired) belong to hiring, not the leads pipeline. */
export const CRM_STATUS_EXCLUDED_DEPARTMENTS = new Set(["Hr"]);

export function classifyStatusName(name: string): { stage: LeadStage; sortOrder: number } {
  return CRM_STATUS_CLASSIFICATION[name] ?? { stage: "OPEN", sortOrder: 0 };
}
