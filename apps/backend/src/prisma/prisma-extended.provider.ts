import { PrismaService } from './prisma.service';
import { softDeleteExtension } from './soft-delete.extension';
import { orgScopeExtension } from './org-scope.extension';

export const PRISMA_EXTENDED_CLIENT = Symbol('PRISMA_EXTENDED_CLIENT');

// Order matters: org-scope must be applied BEFORE soft-delete. soft-delete's delete/deleteMany
// hooks convert to an update/updateMany by calling a fresh top-level client method (not the
// query() passthrough, since it needs a different operation) — that fresh call only picks up
// org-scope's organizationId injection if org-scope was already layered onto the client at the
// point soft-delete captured its `client` reference.
export function prismaExtendedClientFactory(prisma: PrismaService) {
  return prisma.$extends(orgScopeExtension()).$extends(softDeleteExtension());
}

export type ExtendedPrismaClient = ReturnType<typeof prismaExtendedClientFactory>;
