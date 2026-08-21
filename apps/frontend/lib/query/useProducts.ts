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
import { TableState } from "@/hooks/useTableState";

function buildCatalogQuery(state: TableState & { categoryId?: string }): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  if (state.categoryId) params.set("categoryId", state.categoryId);
  return params.toString();
}

export function useProductsCatalog(
  state: TableState & { categoryId?: string },
  initialData?: PaginatedResponse<ProductListItem>,
) {
  return useQuery({
    queryKey: ["products", "catalog", state],
    queryFn: () => api.get<PaginatedResponse<ProductListItem>>(`/api/products?${buildCatalogQuery(state)}`),
    placeholderData: (prev) => prev,
    initialData:
      state.page === 1 && !state.sortBy && !state.q && !state.categoryId ? initialData : undefined,
  });
}

export function useProductsStatSummary(initialData?: ProductsStatSummary) {
  return useQuery({
    queryKey: ["products", "stats", "summary"],
    queryFn: () => api.get<ProductsStatSummary>("/api/products/stats/summary"),
    initialData,
  });
}

export function useProductsByCategory() {
  return useQuery({
    queryKey: ["products", "stats", "by-category"],
    queryFn: () => api.get<CategoryBreakdownEntry[]>("/api/products/stats/by-category"),
  });
}

export function useProductsNeedsAttention() {
  return useQuery({
    queryKey: ["products", "stats", "needs-attention"],
    queryFn: () => api.get<ProductListItem[]>("/api/products/stats/needs-attention"),
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
