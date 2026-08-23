import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/context/tenant-context';

/**
 * Every business-data model except Organization (the tenant root itself) and Role/Permission/
 * RolePermission (global system RBAC, shared across tenants) — including join tables like
 * LeadSourceOnLead, which learned the hard way (a real cross-tenant leak via
 * LeadsService.getSourceBreakdown's direct groupBy) that "reachable only via an already-scoped
 * relation" isn't enough: a groupBy/aggregate against the join table itself has no relation
 * filter to inherit. Kept in sync manually with prisma/schema.prisma, same convention as
 * SOFT_DELETE_MODELS in soft-delete.extension.ts.
 */
const ORG_SCOPED_MODELS = new Set([
  'User',
  'SalesExecutive',
  'Customer',
  'Lead',
  'LeadStatus',
  'LeadSource',
  'LeadType',
  'LeadSourceOnLead',
  'LeadActivity',
  'Dealer',
  'DealerActivity',
  'Architect',
  'Builder',
  'Project',
  'ProjectActivity',
  'ProductCategory',
  'ProductShade',
  'Product',
  'Order',
  'OrderItem',
  'SalesTarget',
  'MarketingCampaign',
  'WebsiteAnalyticsDaily',
  'SearchConsoleDaily',
  'SearchConsoleTopQuery',
  'MarketingLeadAttribution',
  'Complaint',
  'WarrantyClaim',
  'Notification',
  'AuditLog',
  'AIInsight',
  'CompanyProfile',
  'QuotationCounter',
  'LeadCounter',
  'Quotation',
  'QuotationItem',
  'IntegrationConnection',
]);

/**
 * Auto-scopes every query for ORG_SCOPED_MODELS to the current request's tenant, read via
 * TenantContext (AsyncLocalStorage — see common/context/tenant-context.ts). Reads/updates/
 * deletes get `organizationId` forced into `where` (unconditionally overwriting any
 * caller-supplied value, same no-escape-hatch posture as soft-delete.extension.ts); creates
 * get it forced into `data`. This does NOT cover two cases, which need manual scoping at the
 * call site: nested writes (e.g. `quotation.create({ data: { items: { create: [...] } } })`
 * — extensions only intercept the top-level model.method, not inline relation writes), and
 * raw SQL (`$queryRaw`/`$executeRaw` bypass extensions entirely, same as the deletedAt
 * exclusion already handled manually in sales.service.ts).
 */
export function orgScopeExtension() {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'org-scope',
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              args.where = { ...args.where, organizationId: TenantContext.get().organizationId };
            }
            return query(args);
          },
          async findFirst({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              args.where = { ...args.where, organizationId: TenantContext.get().organizationId };
            }
            return query(args);
          },
          async findUnique({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              args.where = {
                ...args.where,
                organizationId: TenantContext.get().organizationId,
              } as typeof args.where;
            }
            return query(args);
          },
          async count({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              args.where = { ...args.where, organizationId: TenantContext.get().organizationId };
            }
            return query(args);
          },
          async aggregate({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              args.where = { ...args.where, organizationId: TenantContext.get().organizationId };
            }
            return query(args);
          },
          async groupBy({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              (args as Record<string, unknown>).where = {
                ...(args as Record<string, unknown>).where as object,
                organizationId: TenantContext.get().organizationId,
              };
            }
            return query(args);
          },
          async create({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              args.data = {
                ...args.data,
                organizationId: TenantContext.get().organizationId,
              } as typeof args.data;
            }
            return query(args);
          },
          async createMany({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              const organizationId = TenantContext.get().organizationId;
              args.data = Array.isArray(args.data)
                ? args.data.map((row) => ({ ...row, organizationId }))
                : ({ ...args.data, organizationId } as typeof args.data);
            }
            return query(args);
          },
          async update({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              args.where = {
                ...args.where,
                organizationId: TenantContext.get().organizationId,
              } as typeof args.where;
            }
            return query(args);
          },
          async updateMany({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              args.where = { ...args.where, organizationId: TenantContext.get().organizationId };
            }
            return query(args);
          },
          async upsert({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              const organizationId = TenantContext.get().organizationId;
              args.where = { ...args.where, organizationId } as typeof args.where;
              args.create = { ...args.create, organizationId } as typeof args.create;
              args.update = { ...args.update, organizationId } as typeof args.update;
            }
            return query(args);
          },
          async delete({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              args.where = {
                ...args.where,
                organizationId: TenantContext.get().organizationId,
              } as typeof args.where;
            }
            return query(args);
          },
          async deleteMany({ model, args, query }) {
            if (ORG_SCOPED_MODELS.has(model)) {
              args.where = { ...args.where, organizationId: TenantContext.get().organizationId };
            }
            return query(args);
          },
        },
      },
    }),
  );
}
