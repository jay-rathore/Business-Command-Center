import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@hpl/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { CurrentUserData } from '../types/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const user: CurrentUserData | undefined = context.switchToHttp().getRequest().user;
    return !!user && requiredRoles.includes(user.roleName);
  }
}
