import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CurrentUserData } from '../types/jwt-payload.interface';
import { TenantContext } from '../context/tenant-context';

/** Registered globally, and FIRST among interceptors (app.module.ts) so it's the outermost
 * wrapper — every other interceptor and the route handler run inside its TenantContext.run(),
 * which is what lets the org-scope Prisma extension (prisma/org-scope.extension.ts) read the
 * current request's organizationId via AsyncLocalStorage instead of it being threaded through
 * every service call. Runs after JwtAuthGuard (guards execute before interceptors in Nest's
 * pipeline), so req.user is already populated for authenticated routes. Public routes (login,
 * health) have no req.user and so get no tenant context — those routes must not touch
 * org-scoped models (true today: login/refresh use the base, unscoped PrismaService). */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: CurrentUserData }>();
    const organizationId = request.user?.organizationId;
    if (!organizationId) return next.handle();

    return new Observable((subscriber) => {
      TenantContext.run({ organizationId }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
