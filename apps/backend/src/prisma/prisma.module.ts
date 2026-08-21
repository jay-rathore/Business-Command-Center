import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PRISMA_EXTENDED_CLIENT, prismaExtendedClientFactory } from './prisma-extended.provider';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: PRISMA_EXTENDED_CLIENT,
      useFactory: prismaExtendedClientFactory,
      inject: [PrismaService],
    },
  ],
  exports: [PrismaService, PRISMA_EXTENDED_CLIENT],
})
export class PrismaModule {}
