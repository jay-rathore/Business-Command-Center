"use client";

import { useQuery } from "@tanstack/react-query";
import { FollowUpRiskLead, PaginatedResponse, SalesTeamExecutive, SalesTeamKpis, SalesTeamLeaderboardEntry } from "@hpl/shared";
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

export function useSalesTeamList(state: TableState & DateRange, initialData?: PaginatedResponse<SalesTeamExecutive>) {
  return useQuery({
    queryKey: ["sales-team", "list", state],
    queryFn: () => api.get<PaginatedResponse<SalesTeamExecutive>>(`/api/sales-team?${buildQuery(state)}`),
    placeholderData: (prev) => prev,
    initialData: state.page === 1 && !state.sortBy && !state.q && !state.dateFrom && !state.dateTo ? initialData : undefined,
  });
}

export function useSalesTeamKpis(range: DateRange = {}, initialData?: SalesTeamKpis) {
  return useQuery({
    queryKey: ["sales-team", "kpis", range.dateFrom, range.dateTo],
    queryFn: () => api.get<SalesTeamKpis>(appendDateRange("/api/sales-team/kpis", range)),
    initialData: !range.dateFrom && !range.dateTo ? initialData : undefined,
  });
}

export function useSalesTeamLeaderboard(range: DateRange = {}) {
  return useQuery({
    queryKey: ["sales-team", "leaderboard", range.dateFrom, range.dateTo],
    queryFn: () => api.get<SalesTeamLeaderboardEntry[]>(appendDateRange("/api/sales-team/leaderboard", range)),
  });
}

export function useSalesTeamFollowUpRisk() {
  return useQuery({
    queryKey: ["sales-team", "follow-up-risk"],
    queryFn: () => api.get<FollowUpRiskLead[]>("/api/sales-team/follow-up-risk"),
  });
}
