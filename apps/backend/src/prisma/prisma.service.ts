import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Bare Prisma client — owns the connection lifecycle only. Feature services should NOT
 * inject this directly (it bypasses the soft-delete extension); inject PRISMA_EXTENDED_CLIENT
 * from prisma-extended.provider.ts instead. Kept as its own class because Prisma's extended
 * client type (from $extends) can't itself be subclassed for Nest's lifecycle hooks.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
