"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CompanyProfileOption,
  CreateQuotationRequest,
  PaginatedResponse,
  ParseQuotationTextRequest,
  ProductCatalogOption,
  QuotationDetail,
  QuotationDraft,
  QuotationListItem,
  SendEmailRequest,
  SendEmailResponse,
  SendWhatsAppRequest,
  SendWhatsAppResponse,
} from "@hpl/shared";
import { api } from "../api/apiClient";
import { TableState } from "@/hooks/useTableState";

function buildQuotationsQuery(state: TableState): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  return params.toString();
}

export function useAllQuotations(state: TableState, initialData?: PaginatedResponse<QuotationListItem>) {
  return useQuery({
    queryKey: ["quotations", "list", state],
    queryFn: () => api.get<PaginatedResponse<QuotationListItem>>(`/api/quotations?${buildQuotationsQuery(state)}`),
    placeholderData: (prev) => prev,
    initialData: state.page === 1 && !state.sortBy && !state.q ? initialData : undefined,
  });
}

export function useCompanyProfileOptions() {
  return useQuery({
    queryKey: ["quotations", "company-profile-options"],
    queryFn: () => api.get<CompanyProfileOption[]>("/api/quotations/company-profile-options"),
    staleTime: 60 * 1000,
  });
}

export function useQuotationProductCatalog() {
  return useQuery({
    queryKey: ["quotations", "products"],
    queryFn: () => api.get<ProductCatalogOption[]>("/api/quotations/products"),
    staleTime: 60 * 1000,
  });
}

export function useLeadQuotations(leadId: string | undefined) {
  return useQuery({
    queryKey: ["quotations", "for-lead", leadId],
    queryFn: () => api.get<QuotationListItem[]>(`/api/leads/${leadId}/quotations`),
    enabled: !!leadId,
  });
}

export function useQuotationDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["quotations", "detail", id],
    queryFn: () => api.get<QuotationDetail>(`/api/quotations/${id}`),
    enabled: !!id,
  });
}

export function useParseQuotationText() {
  return useMutation({
    mutationFn: ({ leadId, ...body }: { leadId: string } & ParseQuotationTextRequest) =>
      api.post<QuotationDraft>(`/api/leads/${leadId}/quotations/parse`, body),
  });
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, ...body }: { leadId: string } & CreateQuotationRequest) =>
      api.post<QuotationDetail>(`/api/leads/${leadId}/quotations`, body),
    onSuccess: (data) => {
      queryClient.setQueryData(["quotations", "detail", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["quotations", "for-lead", data.leadId] });
      queryClient.invalidateQueries({ queryKey: ["quotations", "list"] });
    },
  });
}

export function useSendQuotationWhatsApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, leadId, ...body }: { id: string; leadId: string } & SendWhatsAppRequest) =>
      api.post<SendWhatsAppResponse>(`/api/quotations/${id}/send-whatsapp`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quotations", "detail", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["quotations", "for-lead", variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ["quotations", "list"] });
      queryClient.invalidateQueries({ queryKey: ["leads", "detail", variables.leadId] });
    },
  });
}

export function useSendQuotationEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, leadId, ...body }: { id: string; leadId: string } & SendEmailRequest) =>
      api.post<SendEmailResponse>(`/api/quotations/${id}/send-email`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quotations", "detail", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["quotations", "for-lead", variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ["quotations", "list"] });
      queryClient.invalidateQueries({ queryKey: ["leads", "detail", variables.leadId] });
    },
  });
}

export function quotationPdfUrl(id: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  return `${apiUrl}/api/quotations/${id}/pdf`;
}
