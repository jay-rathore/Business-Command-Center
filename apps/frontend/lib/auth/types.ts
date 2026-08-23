import { RoleName } from "@hpl/shared";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: RoleName;
  permissions: string[];
  salesExecutiveId: string | null;
  isPlatformAdmin: boolean;
  organizationId: string;
  organizationName: string;
}
