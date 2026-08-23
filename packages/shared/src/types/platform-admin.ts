export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  leadCount: number;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  // Optional — leave unset to auto-generate a random one-time password.
  password?: string;
}

export interface ResetAdminPasswordRequest {
  // Optional — leave unset to auto-generate a random one-time password.
  password?: string;
}

export interface CreateOrganizationResponse {
  organization: OrganizationSummary;
  adminEmail: string;
  temporaryPassword: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  slug?: string;
}

export interface ResetAdminPasswordResponse {
  adminEmail: string;
  temporaryPassword: string;
}
