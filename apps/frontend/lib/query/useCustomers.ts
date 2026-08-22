"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CustomerDetail,
  CustomerLeaderboardEntry,
  CustomerListItem,
  CustomerSegment,
  CustomersKpis,
  PaginatedResponse,
} from "@hpl/shared";
import { api } from "../api/apiClient";
import { TableState } from "@/hooks/useTableState";

function buildQuery(state: TableState & { segment?: CustomerSegment }): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  if (state.segment) params.set("segment", state.segment);
  return params.toString();
}

export function useCustomersList(
  state: TableState & { segment?: CustomerSegment },
  initialData?: PaginatedResponse<CustomerListItem>,
) {
  return useQuery({
    queryKey: ["customers", "list", state],
    queryFn: () => api.get<PaginatedResponse<CustomerListItem>>(`/api/customers?${buildQuery(state)}`),
    placeholderData: (prev) => prev,
    initialData: state.page === 1 && !state.sortBy && !state.q && !state.segment ? initialData : undefined,
  });
}

export function useCustomersKpis(initialData?: CustomersKpis) {
  return useQuery({
    queryKey: ["customers", "kpis"],
    queryFn: () => api.get<CustomersKpis>("/api/customers/kpis"),
    initialData,
  });
}

export function useCustomersLeaderboard() {
  return useQuery({
    queryKey: ["customers", "leaderboard"],
    queryFn: () => api.get<CustomerLeaderboardEntry[]>("/api/customers/leaderboard"),
  });
}

export function useCustomersAtRisk() {
  return useQuery({
    queryKey: ["customers", "at-risk"],
    queryFn: () => api.get<CustomerListItem[]>("/api/customers/at-risk"),
  });
}

export function useCustomerDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => api.get<CustomerDetail>(`/api/customers/${id}`),
    enabled: !!id,
  });
}

export function useRecomputeCustomerMetrics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<CustomerDetail>(`/api/customers/${id}/recompute-metrics`),
    onSuccess: (data) => {
      queryClient.setQueryData(["customers", "detail", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
