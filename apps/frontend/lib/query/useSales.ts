"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BreakdownDimension,
  BreakdownEntry,
  PaginatedResponse,
  SalesOverview,
  SalesTableRow,
  SalesTrendPoint,
  TrendGranularity,
} from "@hpl/shared";
import { api } from "../api/apiClient";
import { TableState } from "@/hooks/useTableState";

export function useSalesOverview(initialData?: SalesOverview) {
  return useQuery({
    queryKey: ["sales", "overview"],
    queryFn: () => api.get<SalesOverview>("/api/sales/overview"),
    initialData,
  });
}

export function useSalesRevenueTrend(granularity: TrendGranularity, initialData?: SalesTrendPoint[]) {
  return useQuery({
    queryKey: ["sales", "revenue-trend", granularity],
    queryFn: () => api.get<SalesTrendPoint[]>(`/api/sales/revenue-trend?granularity=${granularity}`),
    initialData: granularity === "monthly" ? initialData : undefined,
  });
}

export function useSalesBreakdown(by: BreakdownDimension) {
  return useQuery({
    queryKey: ["sales", "breakdown", by],
    queryFn: () => api.get<BreakdownEntry[]>(`/api/sales/breakdown?by=${by}`),
  });
}

function buildTableQuery(state: TableState): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  return params.toString();
}

export function useSalesTable(state: TableState) {
  return useQuery({
    queryKey: ["sales", "table", state],
    queryFn: () => api.get<PaginatedResponse<SalesTableRow>>(`/api/sales/table?${buildTableQuery(state)}`),
    placeholderData: (prev) => prev,
  });
}
