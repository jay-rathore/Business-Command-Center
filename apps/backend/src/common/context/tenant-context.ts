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

/** Resolves the single tenant that exists today, for background jobs (cron syncs) that run
 * outside any HTTP request and so have no JWT-derived organizationId to read. Remove this
 * once real multi-tenant onboarding exists and background jobs are scoped per-connection
 * instead of assuming one tenant. */
export function resolveDefaultOrganizationId(prisma: {
  organization: { findFirstOrThrow: () => Promise<{ id: string }> };
}): Promise<string> {
  if (!cachedDefaultOrgId) {
    cachedDefaultOrgId = prisma.organization.findFirstOrThrow().then((org) => org.id);
  }
  return cachedDefaultOrgId;
}
