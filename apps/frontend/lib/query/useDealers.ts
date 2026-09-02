"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DealerDetail, DealerLeaderboardEntry, DealerListItem, DealersKpis, DealerStatus, PaginatedResponse } from "@hpl/shared";
import { api } from "../api/apiClient";
import { appendDateRange, DateRange } from "../dateRange";
import { TableState } from "@/hooks/useTableState";

function buildQuery(state: TableState & { status?: DealerStatus } & DateRange): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  if (state.status) params.set("status", state.status);
  if (state.dateFrom) params.set("dateFrom", state.dateFrom);
  if (state.dateTo) params.set("dateTo", state.dateTo);
  return params.toString();
}

export function useDealersList(
  state: TableState & { status?: DealerStatus } & DateRange,
  initialData?: PaginatedResponse<DealerListItem>,
) {
  return useQuery({
    queryKey: ["dealers", "list", state],
    queryFn: () => api.get<PaginatedResponse<DealerListItem>>(`/api/dealers?${buildQuery(state)}`),
    placeholderData: (prev) => prev,
    initialData:
      state.page === 1 && !state.sortBy && !state.q && !state.status && !state.dateFrom && !state.dateTo ? initialData : undefined,
  });
}

export function useDealersKpis(range: DateRange = {}, initialData?: DealersKpis) {
  return useQuery({
    queryKey: ["dealers", "kpis", range.dateFrom, range.dateTo],
    queryFn: () => api.get<DealersKpis>(appendDateRange("/api/dealers/kpis", range)),
    initialData: !range.dateFrom && !range.dateTo ? initialData : undefined,
  });
}

export function useDealersLeaderboard(range: DateRange = {}) {
  return useQuery({
    queryKey: ["dealers", "leaderboard", range.dateFrom, range.dateTo],
    queryFn: () => api.get<DealerLeaderboardEntry[]>(appendDateRange("/api/dealers/leaderboard", range)),
  });
}

export function useDealersRiskAlerts(range: DateRange = {}) {
  return useQuery({
    queryKey: ["dealers", "risk-alerts", range.dateFrom, range.dateTo],
    queryFn: () => api.get<DealerListItem[]>(appendDateRange("/api/dealers/risk-alerts", range)),
  });
}

export function useDealerDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["dealers", "detail", id],
    queryFn: () => api.get<DealerDetail>(`/api/dealers/${id}`),
    enabled: !!id,
  });
}

export function useRecomputeDealerScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<DealerDetail>(`/api/dealers/${id}/recompute-score`),
    onSuccess: (data) => {
      queryClient.setQueryData(["dealers", "detail", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["dealers"] });
    },
  });
}
