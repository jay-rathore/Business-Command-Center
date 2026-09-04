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

export function useArchitectsList(state: TableState & DateRange, initialData?: PaginatedResponse<ReferralPartnerListItem>) {
  return useQuery({
    queryKey: ["architects", "list", state],
    queryFn: () => api.get<PaginatedResponse<ReferralPartnerListItem>>(`/api/architects?${buildQuery(state)}`),
    placeholderData: (prev) => prev,
    initialData: state.page === 1 && !state.sortBy && !state.q && !state.dateFrom && !state.dateTo ? initialData : undefined,
  });
}

export function useArchitectsKpis(range: DateRange = {}, initialData?: ReferralPartnerKpis) {
  return useQuery({
    queryKey: ["architects", "kpis", range.dateFrom, range.dateTo],
    queryFn: () => api.get<ReferralPartnerKpis>(appendDateRange("/api/architects/kpis", range)),
    initialData: !range.dateFrom && !range.dateTo ? initialData : undefined,
  });
}

export function useArchitectsLeaderboard(range: DateRange = {}) {
  return useQuery({
    queryKey: ["architects", "leaderboard", range.dateFrom, range.dateTo],
    queryFn: () => api.get<ReferralPartnerLeaderboardEntry[]>(appendDateRange("/api/architects/leaderboard", range)),
  });
}

export function useArchitectsRecentReferrals() {
  return useQuery({
    queryKey: ["architects", "recent-referrals"],
    queryFn: () => api.get<RecentReferralItem[]>("/api/architects/recent-referrals"),
  });
}

export function useArchitectDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["architects", "detail", id],
    queryFn: () => api.get<ReferralPartnerListItem>(`/api/architects/${id}`),
    enabled: !!id,
  });
}
