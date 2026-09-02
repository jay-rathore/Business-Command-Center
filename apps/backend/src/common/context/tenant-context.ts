import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantStore {
  organizationId: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

/** Carries the current request's organizationId across the async call chain (controller ->
 * service -> Prisma) so org-scope.extension.ts can auto-inject it into every query without
 * threading it through every function signature. Set once per HTTP request by
 * TenantContextInterceptor, or explicitly via `run()` for background jobs (cron syncs) that
 * have no request to read it from — see resolveDefaultOrganizationId below. */
export class TenantContext {
  static run<T>(store: TenantStore, fn: () => T): T {
    return storage.run(store, fn);
  }

  static get(): TenantStore {
    const store = storage.getStore();
    if (!store) {
      throw new Error(
        'TenantContext accessed outside a tenant-bound request or TenantContext.run() wrapper',
      );
    }
    return store;
  }
}

let cachedDefaultOrgId: Promise<string> | null = null;

/** Resolves the original tenant, for background jobs (cron syncs) that run outside any HTTP
 * request and so have no JWT-derived organizationId to read. Multi-tenant onboarding has since
 * shipped (see platform-admin), so this can no longer assume it's the only row in Organization —
 * without an explicit `orderBy`, `findFirst` returns whatever order Postgres's scan happens to
 * produce, which silently picked up a later-created empty test tenant instead of the real one
 * once platform-admin started seeding test orgs. Ordering by `createdAt` pins it back to the
 * first (real) tenant deterministically. Remove this once background jobs are scoped
 * per-tenant instead of assuming one. */
export function resolveDefaultOrganizationId(prisma: {
  organization: { findFirstOrThrow: (args: { orderBy: { createdAt: 'asc' } }) => Promise<{ id: string }> };
}): Promise<string> {
  if (!cachedDefaultOrgId) {
    cachedDefaultOrgId = prisma.organization.findFirstOrThrow({ orderBy: { createdAt: 'asc' } }).then((org) => org.id);
  }
  return cachedDefaultOrgId;
}
