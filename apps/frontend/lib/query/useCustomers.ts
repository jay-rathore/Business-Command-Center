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
import { appendDateRange, DateRange } from "../dateRange";
import { TableState } from "@/hooks/useTableState";

function buildQuery(state: TableState & { segment?: CustomerSegment } & DateRange): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  if (state.segment) params.set("segment", state.segment);
  if (state.dateFrom) params.set("dateFrom", state.dateFrom);
  if (state.dateTo) params.set("dateTo", state.dateTo);
  return params.toString();
}

export function useCustomersList(
  state: TableState & { segment?: CustomerSegment } & DateRange,
  initialData?: PaginatedResponse<CustomerListItem>,
) {
  return useQuery({
    queryKey: ["customers", "list", state],
    queryFn: () => api.get<PaginatedResponse<CustomerListItem>>(`/api/customers?${buildQuery(state)}`),
    placeholderData: (prev) => prev,
    initialData:
      state.page === 1 && !state.sortBy && !state.q && !state.segment && !state.dateFrom && !state.dateTo ? initialData : undefined,
  });
}

export function useCustomersKpis(range: DateRange = {}, initialData?: CustomersKpis) {
  return useQuery({
    queryKey: ["customers", "kpis", range.dateFrom, range.dateTo],
    queryFn: () => api.get<CustomersKpis>(appendDateRange("/api/customers/kpis", range)),
    initialData: !range.dateFrom && !range.dateTo ? initialData : undefined,
  });
}

export function useCustomersLeaderboard(range: DateRange = {}) {
  return useQuery({
    queryKey: ["customers", "leaderboard", range.dateFrom, range.dateTo],
    queryFn: () => api.get<CustomerLeaderboardEntry[]>(appendDateRange("/api/customers/leaderboard", range)),
  });
}

export function useCustomersAtRisk(range: DateRange = {}) {
  return useQuery({
    queryKey: ["customers", "at-risk", range.dateFrom, range.dateTo],
    queryFn: () => api.get<CustomerListItem[]>(appendDateRange("/api/customers/at-risk", range)),
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
