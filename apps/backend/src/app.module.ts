import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RbacModule } from './rbac/rbac.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { DealersModule } from './dealers/dealers.module';
import { LeadsModule } from './leads/leads.module';
import { ProjectsModule } from './projects/projects.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { QuotationsModule } from './quotations/quotations.module';
import { CompanyProfilesModule } from './company-profiles/company-profiles.module';
import { WhatsAppModule } from './integrations/whatsapp/whatsapp.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RbacModule,
    AuthModule,
    HealthModule,
    ProductsModule,
    SalesModule,
    DealersModule,
    LeadsModule,
    ProjectsModule,
    DashboardModule,
    WhatsAppModule,
    CompanyProfilesModule,
    QuotationsModule,
  ],
  providers: [
    // Order matters: JwtAuthGuard populates req.user first, then Roles/Permissions guards read it.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
