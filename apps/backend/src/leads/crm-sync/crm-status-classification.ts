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

/** HR-department statuses (Offer Sent/Rejected/Hired) belong to hiring, not the leads pipeline. */
export const CRM_STATUS_EXCLUDED_DEPARTMENTS = new Set(["Hr"]);

export function classifyStatusName(name: string): { stage: LeadStage; sortOrder: number } {
  return CRM_STATUS_CLASSIFICATION[name] ?? { stage: "OPEN", sortOrder: 0 };
}
