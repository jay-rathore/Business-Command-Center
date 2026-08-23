"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IntegrationConnectionSummary, IntegrationProvider, UpsertIntegrationConnectionRequest } from "@hpl/shared";
import { api } from "../api/apiClient";

export function useIntegrationConnections(enabled = true) {
  return useQuery({
    queryKey: ["integration-connections", "list"],
    queryFn: () => api.get<IntegrationConnectionSummary[]>("/api/integration-connections"),
    enabled,
  });
}

export function useUpsertIntegrationConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertIntegrationConnectionRequest) =>
      api.post<IntegrationConnectionSummary>("/api/integration-connections", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration-connections"] }),
  });
}

export function useSetIntegrationConnectionActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, isActive }: { provider: IntegrationProvider; isActive: boolean }) =>
      api.post<IntegrationConnectionSummary>(`/api/integration-connections/${provider}/${isActive ? "activate" : "deactivate"}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration-connections"] }),
  });
}
