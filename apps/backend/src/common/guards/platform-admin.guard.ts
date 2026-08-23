import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { CurrentUserData } from '../types/jwt-payload.interface';

/** Applied locally (@UseGuards) on platform-admin-only controllers — not global, since it's
 * unrelated to per-tenant Roles/Permissions. Sits on top of the already-global JwtAuthGuard,
 * which has already populated req.user by the time this runs. */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user: CurrentUserData | undefined = context.switchToHttp().getRequest().user;
    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin access required');
    }
    return true;
  }
}
