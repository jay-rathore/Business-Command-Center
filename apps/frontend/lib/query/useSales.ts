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
import { appendDateRange, DateRange } from "../dateRange";
import { TableState } from "@/hooks/useTableState";

export function useSalesOverview(range: DateRange = {}, initialData?: SalesOverview) {
  return useQuery({
    queryKey: ["sales", "overview", range.dateFrom, range.dateTo],
    queryFn: () => api.get<SalesOverview>(appendDateRange("/api/sales/overview", range)),
    initialData: !range.dateFrom && !range.dateTo ? initialData : undefined,
  });
}

export function useSalesRevenueTrend(granularity: TrendGranularity, range: DateRange = {}, initialData?: SalesTrendPoint[]) {
  return useQuery({
    queryKey: ["sales", "revenue-trend", granularity, range.dateFrom, range.dateTo],
    queryFn: () => api.get<SalesTrendPoint[]>(appendDateRange(`/api/sales/revenue-trend?granularity=${granularity}`, range)),
    initialData: granularity === "monthly" && !range.dateFrom && !range.dateTo ? initialData : undefined,
  });
}

export function useSalesBreakdown(by: BreakdownDimension, range: DateRange = {}) {
  return useQuery({
    queryKey: ["sales", "breakdown", by, range.dateFrom, range.dateTo],
    queryFn: () => api.get<BreakdownEntry[]>(appendDateRange(`/api/sales/breakdown?by=${by}`, range)),
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
