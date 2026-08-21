"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DealerDetail, DealerLeaderboardEntry, DealerListItem, DealersKpis, DealerStatus, PaginatedResponse } from "@hpl/shared";
import { api } from "../api/apiClient";
import { TableState } from "@/hooks/useTableState";

function buildQuery(state: TableState & { status?: DealerStatus }): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  if (state.status) params.set("status", state.status);
  return params.toString();
}

export function useDealersList(state: TableState & { status?: DealerStatus }, initialData?: PaginatedResponse<DealerListItem>) {
  return useQuery({
    queryKey: ["dealers", "list", state],
    queryFn: () => api.get<PaginatedResponse<DealerListItem>>(`/api/dealers?${buildQuery(state)}`),
    placeholderData: (prev) => prev,
    initialData: state.page === 1 && !state.sortBy && !state.q && !state.status ? initialData : undefined,
  });
}

export function useDealersKpis(initialData?: DealersKpis) {
  return useQuery({
    queryKey: ["dealers", "kpis"],
    queryFn: () => api.get<DealersKpis>("/api/dealers/kpis"),
    initialData,
  });
}

export function useDealersLeaderboard() {
  return useQuery({
    queryKey: ["dealers", "leaderboard"],
    queryFn: () => api.get<DealerLeaderboardEntry[]>("/api/dealers/leaderboard"),
  });
}

export function useDealersRiskAlerts() {
  return useQuery({
    queryKey: ["dealers", "risk-alerts"],
    queryFn: () => api.get<DealerListItem[]>("/api/dealers/risk-alerts"),
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
