"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  OrganizationSummary,
  ResetAdminPasswordRequest,
  ResetAdminPasswordResponse,
  UpdateOrganizationRequest,
} from "@hpl/shared";
import { api } from "../api/apiClient";

export function useOrganizations(enabled = true) {
  return useQuery({
    queryKey: ["platform-admin", "organizations"],
    queryFn: () => api.get<OrganizationSummary[]>("/api/platform-admin/organizations"),
    enabled,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrganizationRequest) =>
      api.post<CreateOrganizationResponse>("/api/platform-admin/organizations", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-admin", "organizations"] }),
  });
}

export function useSetOrganizationActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<OrganizationSummary>(`/api/platform-admin/organizations/${id}/active`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-admin", "organizations"] }),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateOrganizationRequest) =>
      api.patch<OrganizationSummary>(`/api/platform-admin/organizations/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-admin", "organizations"] }),
  });
}

export function useResetAdminPassword() {
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & ResetAdminPasswordRequest) =>
      api.post<ResetAdminPasswordResponse>(`/api/platform-admin/organizations/${id}/reset-admin-password`, body),
  });
}
