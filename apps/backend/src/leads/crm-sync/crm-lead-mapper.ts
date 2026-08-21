/** Shapes of the HPL CRM's own REST API responses (apiuatcrm.ultracreation.in), just the
 * fields we read. Framework-agnostic — used by both the one-time import script (prisma/
 * import-crm-snapshot.ts) and the ongoing poll (crm-sync.service.ts) so the field-mapping
 * rules live in exactly one place. */

export interface CrmUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface CrmMembership {
  user: CrmUser;
}

export interface CrmLookupRow {
  id: number;
  name: string;
  department_name?: string | null;
}

export interface CrmLeadNote {
  note: string;
}

export interface CrmLeadRaw {
  id: number;
  assigned_to: CrmMembership | null;
  status: number | null;
  source: number[];
  type: number | null;
  status_detail?: CrmLookupRow | null;
  source_detail?: CrmLookupRow[];
  type_detail?: CrmLookupRow | null;
  notes: CrmLeadNote[];
  name: string;
  lead_company: string;
  location: string;
  state: string | null;
  city: string | null;
  deal_value: string | null;
  email: string;
  phone: string;
  remarks: string | null;
  description: string;
  details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface MappedLead {
  crmId: number;
  leadCode: string;
  name: string;
  company: string | null;
  phone: string;
  email: string | null;
  state: string;
  city: string;
  estimatedValue: number | null;
  notes: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  statusCrmId: number | null;
  sourceCrmIds: number[];
  typeCrmId: number | null;
  assignedRepCrmUserId: number | null;
}

function buildNotes(raw: CrmLeadRaw): string | null {
  const lines: string[] = [];
  if (raw.remarks) lines.push(raw.remarks);
  if (raw.description) lines.push(raw.description);
  for (const n of raw.notes ?? []) {
    if (n.note) lines.push(n.note);
  }
  if (raw.details && typeof raw.details === "object") {
    for (const [key, value] of Object.entries(raw.details)) {
      if (value !== null && value !== undefined && value !== "") lines.push(`${key}: ${value}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

function parseDealValue(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function mapCrmLead(raw: CrmLeadRaw): MappedLead {
  return {
    crmId: raw.id,
    leadCode: `CRM-${raw.id}`,
    name: raw.name || "Unknown",
    company: raw.lead_company || null,
    phone: raw.phone || "",
    email: raw.email || null,
    state: raw.state || "",
    city: raw.city || "",
    estimatedValue: parseDealValue(raw.deal_value),
    notes: buildNotes(raw),
    createdAt: new Date(raw.created_at),
    lastActivityAt: new Date(raw.updated_at || raw.created_at),
    statusCrmId: raw.status,
    sourceCrmIds: raw.source ?? [],
    typeCrmId: raw.type,
    assignedRepCrmUserId: raw.assigned_to?.user?.id ?? null,
  };
}

export interface MappedRep {
  crmUserId: number;
  employeeCode: string;
  name: string;
  email: string | null;
}

export function mapCrmRep(user: CrmUser): MappedRep {
  return {
    crmUserId: user.id,
    employeeCode: `CRM-U${user.id}`,
    name: `${user.first_name} ${user.last_name}`.trim() || user.email,
    email: user.email || null,
  };
}
