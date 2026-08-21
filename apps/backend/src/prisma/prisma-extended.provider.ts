import { PrismaService } from './prisma.service';
import { softDeleteExtension } from './soft-delete.extension';

export const PRISMA_EXTENDED_CLIENT = Symbol('PRISMA_EXTENDED_CLIENT');

export function prismaExtendedClientFactory(prisma: PrismaService) {
  return prisma.$extends(softDeleteExtension());
}

export type ExtendedPrismaClient = ReturnType<typeof prismaExtendedClientFactory>;
