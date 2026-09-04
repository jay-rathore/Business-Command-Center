import { PermissionAction, PermissionModule, RoleName } from '@prisma/client';

export interface RolePermissionSpec {
  module: PermissionModule;
  actions: PermissionAction[];
}

const ALL_MODULES = Object.values(PermissionModule);

/** Phase 1 RBAC matrix (module-level). Row-level scoping (e.g. a Sales Executive only
 * seeing their own assigned leads/projects) is applied inside each service, not here —
 * this only decides which modules a role can touch and at what action level. Seeded into
 * Role/Permission/RolePermission by prisma/seed.ts; read into the JWT payload at login. */
export const ROLE_PERMISSION_MATRIX: Record<RoleName, RolePermissionSpec[]> = {
  OWNER: ALL_MODULES.map((module) => ({ module, actions: [PermissionAction.MANAGE] })),
  ADMIN: ALL_MODULES.map((module) => ({ module, actions: [PermissionAction.MANAGE] })),

  SALES_MANAGER: [
    { module: PermissionModule.DASHBOARD, actions: [PermissionAction.READ] },
    { module: PermissionModule.SALES, actions: [PermissionAction.READ, PermissionAction.WRITE] },
    { module: PermissionModule.LEADS, actions: [PermissionAction.READ, PermissionAction.WRITE] },
    { module: PermissionModule.PROJECTS, actions: [PermissionAction.READ, PermissionAction.WRITE] },
    { module: PermissionModule.SALES_TEAM, actions: [PermissionAction.READ, PermissionAction.WRITE] },
    { module: PermissionModule.ARCHITECTS, actions: [PermissionAction.READ, PermissionAction.WRITE] },
    { module: PermissionModule.BUILDERS, actions: [PermissionAction.READ, PermissionAction.WRITE] },
    { module: PermissionModule.CUSTOMERS, actions: [PermissionAction.READ, PermissionAction.WRITE] },
    // Sales's own "breakdown by product" view depends on product performance data.
    { module: PermissionModule.PRODUCTS, actions: [PermissionAction.READ] },
    { module: PermissionModule.NOTIFICATIONS, actions: [PermissionAction.READ, PermissionAction.WRITE] },
  ],

  SALES_EXECUTIVE: [
    { module: PermissionModule.DASHBOARD, actions: [PermissionAction.READ] },
    { module: PermissionModule.LEADS, actions: [PermissionAction.READ, PermissionAction.WRITE] },
    { module: PermissionModule.PROJECTS, actions: [PermissionAction.READ, PermissionAction.WRITE] },
    { module: PermissionModule.CUSTOMERS, actions: [PermissionAction.READ] },
    { module: PermissionModule.NOTIFICATIONS, actions: [PermissionAction.READ, PermissionAction.WRITE] },
  ],

  MARKETING_MANAGER: [
    { module: PermissionModule.DASHBOARD, actions: [PermissionAction.READ] },
    { module: PermissionModule.LEADS, actions: [PermissionAction.READ] },
    { module: PermissionModule.MARKETING, actions: [PermissionAction.READ, PermissionAction.WRITE] },
    { module: PermissionModule.NOTIFICATIONS, actions: [PermissionAction.READ, PermissionAction.WRITE] },
  ],

  DEALER_MANAGER: [
    { module: PermissionModule.DASHBOARD, actions: [PermissionAction.READ] },
    { module: PermissionModule.DEALERS, actions: [PermissionAction.READ, PermissionAction.WRITE] },
    { module: PermissionModule.NOTIFICATIONS, actions: [PermissionAction.READ, PermissionAction.WRITE] },
  ],
};

export function permissionCode(module: PermissionModule, action: PermissionAction): string {
  return `${module.toLowerCase()}:${action.toLowerCase()}`;
}

/** Guards check exact codes (e.g. @RequirePermission('products:read')) — no hierarchy logic
 * at request time. So a role granted MANAGE must also be granted READ/WRITE/DELETE explicitly
 * at seed time, otherwise "manage" alone wouldn't satisfy a "read" check and Owner/Admin would
 * be locked out of their own read endpoints. */
export function expandActions(actions: PermissionAction[]): PermissionAction[] {
  if (actions.includes(PermissionAction.MANAGE)) {
    return [PermissionAction.READ, PermissionAction.WRITE, PermissionAction.DELETE, PermissionAction.MANAGE];
  }
  return actions;
}
