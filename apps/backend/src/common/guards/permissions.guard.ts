import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { CurrentUserData } from '../types/jwt-payload.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermission) return true;

    const user: CurrentUserData | undefined = context.switchToHttp().getRequest().user;
    if (!user || !user.permissions.includes(requiredPermission)) {
      throw new ForbiddenException(`Missing permission: ${requiredPermission}`);
    }
    return true;
  }
}
