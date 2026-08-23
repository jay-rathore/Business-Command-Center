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

// One run endpoint per syncable provider — WhatsApp/Email have no "sync" concept (they're
// send-time only), so they're deliberately not in this map.
const SYNC_RUN_PATHS: Partial<Record<IntegrationProvider, string>> = {
  META_ADS: "/api/marketing/meta-ads-sync/run",
  GOOGLE_ADS: "/api/marketing/google-ads-sync/run",
  GOOGLE_ANALYTICS: "/api/marketing/google-analytics-sync/run",
  SEARCH_CONSOLE: "/api/marketing/search-console-sync/run",
  WOOCOMMERCE: "/api/products/wc-sync/run",
};

export function isSyncableProvider(provider: IntegrationProvider): boolean {
  return provider in SYNC_RUN_PATHS;
}

export interface SyncRunResult {
  processed: number;
  created: number;
  updated: number;
}

export function useTriggerSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: IntegrationProvider) => {
      const path = SYNC_RUN_PATHS[provider];
      if (!path) throw new Error(`${provider} has no sync to run`);
      return api.post<SyncRunResult>(path);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-connections"] });
      queryClient.invalidateQueries({ queryKey: ["marketing"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
