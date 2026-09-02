"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CategoryBreakdownEntry,
  PaginatedResponse,
  ProductCategoryOption,
  ProductDetail,
  ProductListItem,
  ProductsStatSummary,
} from "@hpl/shared";
import { api } from "../api/apiClient";
import { appendDateRange, DateRange } from "../dateRange";
import { TableState } from "@/hooks/useTableState";

function buildCatalogQuery(state: TableState & { categoryId?: string } & DateRange): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  if (state.categoryId) params.set("categoryId", state.categoryId);
  if (state.dateFrom) params.set("dateFrom", state.dateFrom);
  if (state.dateTo) params.set("dateTo", state.dateTo);
  return params.toString();
}

export function useProductsCatalog(
  state: TableState & { categoryId?: string } & DateRange,
  initialData?: PaginatedResponse<ProductListItem>,
) {
  return useQuery({
    queryKey: ["products", "catalog", state],
    queryFn: () => api.get<PaginatedResponse<ProductListItem>>(`/api/products?${buildCatalogQuery(state)}`),
    placeholderData: (prev) => prev,
    initialData:
      state.page === 1 && !state.sortBy && !state.q && !state.categoryId && !state.dateFrom && !state.dateTo
        ? initialData
        : undefined,
  });
}

export function useProductsStatSummary(range: DateRange = {}, initialData?: ProductsStatSummary) {
  return useQuery({
    queryKey: ["products", "stats", "summary", range.dateFrom, range.dateTo],
    queryFn: () => api.get<ProductsStatSummary>(appendDateRange("/api/products/stats/summary", range)),
    initialData: !range.dateFrom && !range.dateTo ? initialData : undefined,
  });
}

export function useProductsByCategory(range: DateRange = {}) {
  return useQuery({
    queryKey: ["products", "stats", "by-category", range.dateFrom, range.dateTo],
    queryFn: () => api.get<CategoryBreakdownEntry[]>(appendDateRange("/api/products/stats/by-category", range)),
  });
}

export function useProductsNeedsAttention(range: DateRange = {}) {
  return useQuery({
    queryKey: ["products", "stats", "needs-attention", range.dateFrom, range.dateTo],
    queryFn: () => api.get<ProductListItem[]>(appendDateRange("/api/products/stats/needs-attention", range)),
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: ["products", "categories"],
    queryFn: () => api.get<ProductCategoryOption[]>("/api/products/categories"),
  });
}

export function useProductDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["products", "detail", id],
    queryFn: () => api.get<ProductDetail>(`/api/products/${id}`),
    enabled: !!id,
  });
}
