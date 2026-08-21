/**
 * One-time backfill: loads the HPL CRM snapshot (pulled read-only from
 * apiuatcrm.ultracreation.in, company "Shreenath Global"/HPL Maker) from
 * prisma/crm-snapshot/*.json into this app's own Lead/LeadStatus/LeadSource/LeadType/
 * SalesExecutive tables.
 *
 * Idempotent: every row is keyed by the CRM's own id (Lead.crmId, LeadStatus.crmId, etc.)
 * with skipDuplicates, so re-running this only inserts what's missing.
 *
 * Usage: npm run db:import-crm   (see package.json)
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { computeLeadScore } from '../src/leads/lead-scoring.util';
import { classifyStatusName, CRM_STATUS_EXCLUDED_DEPARTMENTS } from '../src/leads/crm-sync/crm-status-classification';
import { CrmLeadRaw, CrmLookupRow, mapCrmLead, mapCrmRep } from '../src/leads/crm-sync/crm-lead-mapper';

const prisma = new PrismaClient();
const SNAPSHOT_DIR = path.join(__dirname, 'crm-snapshot');
const CHUNK_SIZE = 2000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function loadLookups() {
  const raw = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, 'hpl_lookups.json'), 'utf8')) as {
    status: CrmLookupRow[];
    source: CrmLookupRow[];
    type: CrmLookupRow[];
  };
  return raw;
}

/** The company-scoped `/api/leads/status|source|type/` list (hpl_lookups.json) can miss rows
 * that a Lead still references directly (e.g. legacy `company: null` status rows visible only
 * through the lead's own embedded `status_detail`). Union both sources, deduped by id, so
 * nothing referenced by an actual lead gets silently dropped. */
function withEmbeddedDetails(rows: CrmLookupRow[], leads: CrmLeadRaw[], field: 'status_detail' | 'type_detail'): CrmLookupRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const l of leads) {
    const detail = l[field];
    if (detail && !byId.has(detail.id)) byId.set(detail.id, detail);
  }
  return [...byId.values()];
}

function sourcesWithEmbeddedDetails(rows: CrmLookupRow[], leads: CrmLeadRaw[]): CrmLookupRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const l of leads) {
    for (const s of l.source_detail ?? []) {
      if (!byId.has(s.id)) byId.set(s.id, s);
    }
  }
  return [...byId.values()];
}

/** Upserts deduped-by-name LeadStatus rows and returns a map from EVERY CRM status id
 * (including duplicate-named ones) to the single resulting row id. */
async function seedStatuses(rows: CrmLookupRow[]): Promise<Map<number, string>> {
  const eligible = rows.filter((r) => !CRM_STATUS_EXCLUDED_DEPARTMENTS.has(r.department_name ?? ''));
  const byName = new Map<string, CrmLookupRow[]>();
  for (const r of eligible) {
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name)!.push(r);
  }

  const crmIdToRowId = new Map<number, string>();
  for (const [name, variants] of byName) {
    const { stage, sortOrder } = classifyStatusName(name);
    const primaryCrmId = variants[0].id;
    const row = await prisma.leadStatus.upsert({
      where: { crmId: primaryCrmId },
      update: { name, stage, sortOrder },
      create: { crmId: primaryCrmId, name, stage, sortOrder },
    });
    for (const variant of variants) crmIdToRowId.set(variant.id, row.id);
  }
  return crmIdToRowId;
}

async function seedSimpleLookup(
  model: 'leadSource' | 'leadType',
  rows: CrmLookupRow[],
): Promise<Map<number, string>> {
  const crmIdToRowId = new Map<number, string>();
  const byName = new Map<string, number>(); // name -> primary crmId, dedupe safety net
  for (const r of rows) {
    const primaryCrmId = byName.get(r.name) ?? r.id;
    byName.set(r.name, primaryCrmId);
  }
  for (const r of rows) {
    const primaryCrmId = byName.get(r.name)!;
    if (!crmIdToRowId.has(primaryCrmId)) {
      const row = await (prisma[model] as any).upsert({
        where: { crmId: primaryCrmId },
        update: { name: r.name },
        create: { crmId: primaryCrmId, name: r.name },
      });
      crmIdToRowId.set(primaryCrmId, row.id);
    }
    crmIdToRowId.set(r.id, crmIdToRowId.get(primaryCrmId)!);
  }
  return crmIdToRowId;
}

async function seedReps(leads: CrmLeadRaw[]): Promise<Map<number, string>> {
  const uniqueUsers = new Map<number, ReturnType<typeof mapCrmRep>>();
  for (const l of leads) {
    const user = l.assigned_to?.user;
    if (user && !uniqueUsers.has(user.id)) uniqueUsers.set(user.id, mapCrmRep(user));
  }

  const crmUserIdToExecId = new Map<number, string>();
  for (const rep of uniqueUsers.values()) {
    const row = await prisma.salesExecutive.upsert({
      where: { employeeCode: rep.employeeCode },
      update: { name: rep.name, email: rep.email },
      create: { employeeCode: rep.employeeCode, name: rep.name, email: rep.email, designation: 'Sales Executive' },
    });
    crmUserIdToExecId.set(rep.crmUserId, row.id);
  }
  return crmUserIdToExecId;
}

async function main() {
  console.log('Loading snapshot files...');
  const lookups = await loadLookups();
  const leads = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, 'hpl_leads.json'), 'utf8')) as CrmLeadRaw[];
  console.log(`  ${leads.length} leads, ${lookups.status.length} statuses, ${lookups.source.length} sources, ${lookups.type.length} types`);

  console.log('Seeding lookup tables...');
  const statusMap = await seedStatuses(withEmbeddedDetails(lookups.status, leads, 'status_detail'));
  const sourceMap = await seedSimpleLookup('leadSource', sourcesWithEmbeddedDetails(lookups.source, leads));
  const typeMap = await seedSimpleLookup('leadType', withEmbeddedDetails(lookups.type, leads, 'type_detail'));
  console.log(`  ${new Set(statusMap.values()).size} statuses, ${new Set(sourceMap.values()).size} sources, ${new Set(typeMap.values()).size} types`);

  console.log('Seeding sales reps...');
  const repMap = await seedReps(leads);
  console.log(`  ${repMap.size} sales reps`);

  // Small tables (~30 statuses, ~17 sources) — fetch once for score lookups during the batch loop below.
  const statusScoreById = new Map((await prisma.leadStatus.findMany()).map((s) => [s.id, { score: s.score, stage: s.stage }]));
  const sourceScoreById = new Map((await prisma.leadSource.findMany()).map((s) => [s.id, s.score]));

  console.log('Importing leads...');
  let createdLeads = 0;
  let skippedUnknownStatus = 0;
  for (const batch of chunk(leads, CHUNK_SIZE)) {
    const data = batch.map((raw) => {
      const mapped = mapCrmLead(raw);
      const statusId = mapped.statusCrmId != null ? statusMap.get(mapped.statusCrmId) ?? null : null;
      if (mapped.statusCrmId != null && !statusId) skippedUnknownStatus++;
      const leadTypeId = mapped.typeCrmId != null ? typeMap.get(mapped.typeCrmId) ?? null : null;
      const assignedExecId = mapped.assignedRepCrmUserId != null ? repMap.get(mapped.assignedRepCrmUserId) ?? null : null;

      const daysSinceActivity = Math.round((Date.now() - mapped.lastActivityAt.getTime()) / 86400000);
      const sourceScores = mapped.sourceCrmIds
        .map((id) => sourceMap.get(id))
        .filter((v): v is string => !!v)
        .map((rowId) => sourceScoreById.get(rowId) ?? 0);
      const statusInfo = statusId ? statusScoreById.get(statusId) : undefined;
      const score = computeLeadScore({
        sourceScores,
        statusScore: statusInfo?.score ?? null,
        isLost: statusInfo?.stage === 'LOST',
        estimatedValue: mapped.estimatedValue,
        daysSinceActivity,
      });

      return {
        crmId: mapped.crmId,
        leadCode: mapped.leadCode,
        name: mapped.name,
        company: mapped.company,
        phone: mapped.phone,
        email: mapped.email,
        state: mapped.state,
        city: mapped.city,
        leadTypeId,
        assignedExecId,
        statusId,
        estimatedValue: mapped.estimatedValue,
        notes: mapped.notes,
        lastActivityAt: mapped.lastActivityAt,
        createdAt: mapped.createdAt,
        wonAt: statusInfo?.stage === 'WON' ? mapped.lastActivityAt : null,
        lostAt: statusInfo?.stage === 'LOST' ? mapped.lastActivityAt : null,
        score,
      };
    });

    const result = await prisma.lead.createMany({ data, skipDuplicates: true });
    createdLeads += result.count;
    process.stdout.write(`\r  ${createdLeads}/${leads.length} leads imported...`);
  }
  console.log(`\n  ${createdLeads} leads created (${leads.length - createdLeads} already existed or were skipped)`);
  if (skippedUnknownStatus > 0) console.log(`  Note: ${skippedUnknownStatus} leads referenced a status id not found in the lookup snapshot (left statusId null)`);

  console.log('Linking lead sources...');
  const idByCrmId = new Map<number, string>();
  const importedLeads = await prisma.lead.findMany({ where: { crmId: { not: null } }, select: { id: true, crmId: true } });
  for (const l of importedLeads) idByCrmId.set(l.crmId!, l.id);

  let sourceLinks = 0;
  for (const batch of chunk(leads, CHUNK_SIZE)) {
    const joinRows: { leadId: string; leadSourceId: string }[] = [];
    for (const raw of batch) {
      const leadId = idByCrmId.get(raw.id);
      if (!leadId) continue;
      for (const sourceCrmId of raw.source ?? []) {
        const leadSourceId = sourceMap.get(sourceCrmId);
        if (leadSourceId) joinRows.push({ leadId, leadSourceId });
      }
    }
    if (joinRows.length === 0) continue;
    const result = await prisma.leadSourceOnLead.createMany({ data: joinRows, skipDuplicates: true });
    sourceLinks += result.count;
  }
  console.log(`  ${sourceLinks} lead-source links created`);

  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
