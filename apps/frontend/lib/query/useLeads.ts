"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BusinessCardDraft,
  CreateLeadFromCardRequest,
  DuplicateLeadMatch,
  ExecutiveOption,
  FunnelStage,
  LeadDetail,
  LeadListItem,
  LeadsKpis,
  LeadStatusOption,
  LeadTypeOption,
  PaginatedResponse,
  SourceBreakdownEntry,
} from "@hpl/shared";
import { api } from "../api/apiClient";
import { TableState } from "@/hooks/useTableState";

function buildQuery(state: TableState & { statusId?: string }): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  if (state.statusId) params.set("statusId", state.statusId);
  return params.toString();
}

export function useLeadsList(state: TableState & { statusId?: string }, initialData?: PaginatedResponse<LeadListItem>) {
  return useQuery({
    queryKey: ["leads", "list", state],
    queryFn: () => api.get<PaginatedResponse<LeadListItem>>(`/api/leads?${buildQuery(state)}`),
    placeholderData: (prev) => prev,
    initialData: state.page === 1 && !state.sortBy && !state.q && !state.statusId ? initialData : undefined,
  });
}

export function useLeadsKpis(initialData?: LeadsKpis) {
  return useQuery({
    queryKey: ["leads", "kpis"],
    queryFn: () => api.get<LeadsKpis>("/api/leads/kpis"),
    initialData,
  });
}

export function useLeadsFunnel(initialData?: FunnelStage[]) {
  return useQuery({
    queryKey: ["leads", "funnel"],
    queryFn: () => api.get<FunnelStage[]>("/api/leads/funnel"),
    initialData,
  });
}

export function useLeadsSources() {
  return useQuery({
    queryKey: ["leads", "sources"],
    queryFn: () => api.get<SourceBreakdownEntry[]>("/api/leads/sources"),
  });
}

export function useLeadStatuses(initialData?: LeadStatusOption[]) {
  return useQuery({
    queryKey: ["leads", "statuses"],
    queryFn: () => api.get<LeadStatusOption[]>("/api/leads/statuses"),
    initialData,
    staleTime: 5 * 60 * 1000, // taxonomy changes rarely; avoid refetching on every mount
  });
}

export function useLeadDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["leads", "detail", id],
    queryFn: () => api.get<LeadDetail>(`/api/leads/${id}`),
    enabled: !!id,
  });
}

export function useAddLeadActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, ...body }: { leadId: string; type: string; note?: string; newStatusId?: string }) =>
      api.post<LeadDetail>(`/api/leads/${leadId}/activities`, body),
    onSuccess: (data) => {
      queryClient.setQueryData(["leads", "detail", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useLeadTypes() {
  return useQuery({
    queryKey: ["leads", "types"],
    queryFn: () => api.get<LeadTypeOption[]>("/api/leads/types"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeadExecutives() {
  return useQuery({
    queryKey: ["leads", "executives"],
    queryFn: () => api.get<ExecutiveOption[]>("/api/leads/executives"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useScanBusinessCard() {
  return useMutation({
    mutationFn: (imageDataUrl: string) => api.post<BusinessCardDraft>("/api/leads/business-card/scan", { imageDataUrl }),
  });
}

export function useLeadDuplicates() {
  return useMutation({
    mutationFn: ({ phone, email }: { phone: string; email?: string | null }) => {
      const params = new URLSearchParams({ phone });
      if (email) params.set("email", email);
      return api.get<DuplicateLeadMatch[]>(`/api/leads/duplicates?${params.toString()}`);
    },
  });
}

export function useCreateLeadFromCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLeadFromCardRequest) => api.post<LeadDetail>("/api/leads", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function leadBusinessCardImageUrl(id: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  return `${apiUrl}/api/leads/${id}/business-card-image`;
}
