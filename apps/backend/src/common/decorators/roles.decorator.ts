import { SetMetadata } from '@nestjs/common';
import { RoleName } from '@hpl/shared';

export const ROLES_KEY = 'roles';

/** Coarse role check, e.g. @Roles(RoleName.OWNER, RoleName.ADMIN). */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
