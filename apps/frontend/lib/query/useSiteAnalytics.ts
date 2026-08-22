"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SearchConsoleSummary, SiteAnalyticsSummary } from "@hpl/shared";
import { api } from "../api/apiClient";

export function useSiteAnalytics(initialData?: SiteAnalyticsSummary) {
  return useQuery({
    queryKey: ["marketing", "site-analytics"],
    queryFn: () => api.get<SiteAnalyticsSummary>("/api/marketing/google-analytics-sync"),
    initialData,
  });
}

export function useSearchConsole(initialData?: SearchConsoleSummary) {
  return useQuery({
    queryKey: ["marketing", "search-console"],
    queryFn: () => api.get<SearchConsoleSummary>("/api/marketing/search-console-sync"),
    initialData,
  });
}

export function useRecomputeGoogleAnalyticsSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ processed: number; created: number; updated: number }>("/api/marketing/google-analytics-sync/run"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing", "site-analytics"] }),
  });
}

export function useRecomputeSearchConsoleSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ dailyRows: number; topQueries: number }>("/api/marketing/search-console-sync/run"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing", "search-console"] }),
  });
}
