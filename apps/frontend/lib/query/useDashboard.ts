"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AiExecutiveSummary,
  AttentionItem,
  BusinessHealthSignal,
  ContributorEntry,
  ContributorTab,
  DashboardSummary,
} from "@hpl/shared";
import { api } from "../api/apiClient";

export function useDashboardSummary(initialData?: DashboardSummary) {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api.get<DashboardSummary>("/api/dashboard/summary"),
    initialData,
  });
}

export function useBusinessHealth(initialData?: BusinessHealthSignal[]) {
  return useQuery({
    queryKey: ["dashboard", "business-health"],
    queryFn: () => api.get<BusinessHealthSignal[]>("/api/dashboard/business-health"),
    initialData,
  });
}

export function useAttentionFeed(initialData?: AttentionItem[]) {
  return useQuery({
    queryKey: ["dashboard", "attention"],
    queryFn: () => api.get<AttentionItem[]>("/api/dashboard/attention"),
    initialData,
  });
}

export function useContributors(tab: ContributorTab) {
  return useQuery({
    queryKey: ["dashboard", "contributors", tab],
    queryFn: () => api.get<ContributorEntry[]>(`/api/dashboard/contributors?tab=${tab}`),
  });
}

export function useAiSummary(initialData?: AiExecutiveSummary) {
  return useQuery({
    queryKey: ["dashboard", "ai-summary"],
    queryFn: () => api.get<AiExecutiveSummary>("/api/dashboard/ai-summary"),
    initialData,
  });
}
