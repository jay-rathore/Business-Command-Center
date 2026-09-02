"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PaginatedResponse, SalesTargetItem, SalesTargetScope, UpsertSalesTargetRequest } from "@hpl/shared";
import { api } from "../api/apiClient";

export function useSalesTargets(scope?: SalesTargetScope) {
  return useQuery({
    queryKey: ["sales-targets", "list", scope],
    queryFn: () => api.get<PaginatedResponse<SalesTargetItem>>(`/api/sales-targets?pageSize=100${scope ? `&scope=${scope}` : ""}`),
  });
}

export function useCreateSalesTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertSalesTargetRequest) => api.post<SalesTargetItem>("/api/sales-targets", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-targets"] });
    },
  });
}

export function useUpdateSalesTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpsertSalesTargetRequest) =>
      api.patch<SalesTargetItem>(`/api/sales-targets/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-targets"] });
    },
  });
}

export function useDeleteSalesTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/sales-targets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-targets"] });
    },
  });
}
