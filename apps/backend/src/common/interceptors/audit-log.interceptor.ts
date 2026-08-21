import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditAction, PermissionModule } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUserData } from '../types/jwt-payload.interface';

const METHOD_ACTION: Partial<Record<string, AuditAction>> = {
  POST: AuditAction.CREATE,
  PATCH: AuditAction.UPDATE,
  PUT: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

/** First path segment after /api/ maps to the module for audit purposes, e.g. /api/sales/:id -> SALES. */
const ROUTE_MODULE: Partial<Record<string, PermissionModule>> = {
  sales: PermissionModule.SALES,
  leads: PermissionModule.LEADS,
  dealers: PermissionModule.DEALERS,
  projects: PermissionModule.PROJECTS,
  products: PermissionModule.PRODUCTS,
  dashboard: PermissionModule.DASHBOARD,
  quotations: PermissionModule.LEADS,
  'company-profiles': PermissionModule.SETTINGS,
};

/** Registered globally. Writes an AuditLog row for every mutating request (POST/PATCH/PUT/DELETE)
 * whose route maps to a known module. Audit writes are best-effort — a failure here must never
 * break the primary request. Per-endpoint beforeValue diffing is added module-by-module as each
 * mutating endpoint is built, not attempted generically here. */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: CurrentUserData }>();
    const action = METHOD_ACTION[req.method];
    if (!action) return next.handle();

    const segments = req.baseUrl.split('/').filter(Boolean); // ["api", "sales", ":id"]
    const module = ROUTE_MODULE[segments[1]];
    if (!module) return next.handle();

    return next.handle().pipe(
      tap((result: unknown) => {
        const recordId =
          (result as { id?: string } | undefined)?.id ?? (req.params as Record<string, string>)?.id ?? null;

        this.prisma.auditLog
          .create({
            data: {
              userId: req.user?.sub ?? null,
              action,
              module,
              recordId,
              afterValue: result === undefined ? undefined : (result as object),
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            },
          })
          .catch((err: unknown) => this.logger.warn(`Failed to write audit log: ${String(err)}`));
      }),
    );
  }
}
