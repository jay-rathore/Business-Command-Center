import { Prisma } from '@prisma/client';

/**
 * Models with a `deletedAt` column. Kept in sync manually with prisma/schema.prisma —
 * append-only logs (LeadActivity, DealerActivity, ProjectActivity, AuditLog, Notification,
 * OrderItem, MarketingLeadAttribution, AIInsight) and the RBAC tables (Role, Permission,
 * RolePermission) are intentionally excluded; they're never soft-deleted.
 */
const SOFT_DELETE_MODELS = new Set([
  'User',
  'SalesExecutive',
  'Customer',
  'Lead',
  'Dealer',
  'Architect',
  'Builder',
  'Project',
  'ProductCategory',
  'ProductShade',
  'Product',
  'Order',
  'SalesTarget',
  'MarketingCampaign',
  'Complaint',
  'WarrantyClaim',
]);

/**
 * Auto-filters `deletedAt: null` into reads for soft-deletable models, and rewrites
 * delete/deleteMany into an update/updateMany that stamps `deletedAt`. There is no
 * "includeDeleted" escape hatch yet — no Phase 1 screen needs to view/restore soft-deleted
 * records; add one (a typed query option) when that need actually arrives.
 */
export function softDeleteExtension() {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'soft-delete',
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) {
              args.where = { ...args.where, deletedAt: null };
            }
            return query(args);
          },
          async findFirst({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) {
              args.where = { ...args.where, deletedAt: null };
            }
            return query(args);
          },
          async findUnique({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) {
              args.where = { ...args.where, deletedAt: null } as typeof args.where;
            }
            return query(args);
          },
          async count({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) {
              args.where = { ...args.where, deletedAt: null };
            }
            return query(args);
          },
          async delete({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) {
              return (client as Record<string, any>)[uncapitalize(model)].update({
                where: args.where,
                data: { deletedAt: new Date() },
              });
            }
            return query(args);
          },
          async deleteMany({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(model)) {
              return (client as Record<string, any>)[uncapitalize(model)].updateMany({
                where: args.where,
                data: { deletedAt: new Date() },
              });
            }
            return query(args);
          },
        },
      },
    }),
  );
}

function uncapitalize(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}
