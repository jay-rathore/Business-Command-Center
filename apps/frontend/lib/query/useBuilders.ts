"use client";

import { useQuery } from "@tanstack/react-query";
import {
  PaginatedResponse,
  RecentReferralItem,
  ReferralPartnerKpis,
  ReferralPartnerLeaderboardEntry,
  ReferralPartnerListItem,
} from "@hpl/shared";
import { api } from "../api/apiClient";
import { appendDateRange, DateRange } from "../dateRange";
import { TableState } from "@/hooks/useTableState";

function buildQuery(state: TableState & DateRange): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  if (state.dateFrom) params.set("dateFrom", state.dateFrom);
  if (state.dateTo) params.set("dateTo", state.dateTo);
  return params.toString();
}

export function useBuildersList(state: TableState & DateRange, initialData?: PaginatedResponse<ReferralPartnerListItem>) {
  return useQuery({
    queryKey: ["builders", "list", state],
    queryFn: () => api.get<PaginatedResponse<ReferralPartnerListItem>>(`/api/builders?${buildQuery(state)}`),
    placeholderData: (prev) => prev,
    initialData: state.page === 1 && !state.sortBy && !state.q && !state.dateFrom && !state.dateTo ? initialData : undefined,
  });
}

export function useBuildersKpis(range: DateRange = {}, initialData?: ReferralPartnerKpis) {
  return useQuery({
    queryKey: ["builders", "kpis", range.dateFrom, range.dateTo],
    queryFn: () => api.get<ReferralPartnerKpis>(appendDateRange("/api/builders/kpis", range)),
    initialData: !range.dateFrom && !range.dateTo ? initialData : undefined,
  });
}

export function useBuildersLeaderboard(range: DateRange = {}) {
  return useQuery({
    queryKey: ["builders", "leaderboard", range.dateFrom, range.dateTo],
    queryFn: () => api.get<ReferralPartnerLeaderboardEntry[]>(appendDateRange("/api/builders/leaderboard", range)),
  });
}

export function useBuildersRecentReferrals() {
  return useQuery({
    queryKey: ["builders", "recent-referrals"],
    queryFn: () => api.get<RecentReferralItem[]>("/api/builders/recent-referrals"),
  });
}

export function useBuilderDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["builders", "detail", id],
    queryFn: () => api.get<ReferralPartnerListItem>(`/api/builders/${id}`),
    enabled: !!id,
  });
}
