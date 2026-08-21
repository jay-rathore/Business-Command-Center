"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CompanyProfile, UpsertCompanyProfileRequest } from "@hpl/shared";
import { api } from "../api/apiClient";

export function useCompanyProfiles(enabled = true) {
  return useQuery({
    queryKey: ["company-profiles", "list"],
    queryFn: () => api.get<CompanyProfile[]>("/api/company-profiles"),
    enabled,
  });
}

export function useCreateCompanyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertCompanyProfileRequest) => api.post<CompanyProfile>("/api/company-profiles", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["quotations", "company-profile-options"] });
    },
  });
}

export function useUpdateCompanyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpsertCompanyProfileRequest) =>
      api.patch<CompanyProfile>(`/api/company-profiles/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["quotations", "company-profile-options"] });
    },
  });
}
