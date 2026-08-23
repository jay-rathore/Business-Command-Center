import { RoleName } from '@hpl/shared';

/** Embedded in the access-token JWT. Permission codes (e.g. "sales:read") are baked in
 * at login, so guards never hit the DB — the tradeoff is up to JWT_ACCESS_TTL of staleness
 * if a role's permissions change, which is acceptable at this scale. */
export interface JwtPayload {
  sub: string; // User.id
  organizationId: string;
  email: string;
  roleId: string;
  roleName: RoleName;
  permissions: string[];
  salesExecutiveId: string | null;
  isPlatformAdmin: boolean;
}

export type CurrentUserData = JwtPayload;
