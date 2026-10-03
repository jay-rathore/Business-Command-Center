"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  InvoiceDetail,
  InvoiceListItem,
  PaginatedResponse,
  SaveInvoiceRequest,
  SendEmailRequest,
  SendInvoiceResponse,
  SendWhatsAppRequest,
} from "@hpl/shared";
import { api } from "../api/apiClient";
import { TableState } from "@/hooks/useTableState";

function buildInvoicesQuery(state: TableState): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  return params.toString();
}

export function useAllInvoices(state: TableState) {
  return useQuery({
    queryKey: ["invoices", "list", state],
    queryFn: () => api.get<PaginatedResponse<InvoiceListItem>>(`/api/invoices?${buildInvoicesQuery(state)}`),
    placeholderData: (prev) => prev,
  });
}

export function useInvoiceDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["invoices", "detail", id],
    queryFn: () => api.get<InvoiceDetail>(`/api/invoices/${id}`),
    enabled: !!id,
  });
}

/** A saved/sent invoice changes the invoice list, its own detail, and the quotation that points at it. */
function useInvalidateInvoiceViews() {
  const queryClient = useQueryClient();
  return (invoice: Pick<InvoiceDetail, "id" | "quotationId" | "leadId">) => {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["quotations"] });
    queryClient.invalidateQueries({ queryKey: ["leads", "detail", invoice.leadId] });
  };
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateInvoiceViews();
  return useMutation({
    mutationFn: ({ quotationId, ...body }: { quotationId: string } & SaveInvoiceRequest) =>
      api.post<InvoiceDetail>(`/api/quotations/${quotationId}/invoice`, body),
    onSuccess: (invoice) => {
      queryClient.setQueryData(["invoices", "detail", invoice.id], invoice);
      invalidate(invoice);
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateInvoiceViews();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & SaveInvoiceRequest) => api.patch<InvoiceDetail>(`/api/invoices/${id}`, body),
    onSuccess: (invoice) => {
      queryClient.setQueryData(["invoices", "detail", invoice.id], invoice);
      invalidate(invoice);
    },
  });
}

export function useSendInvoiceEmail() {
  const invalidate = useInvalidateInvoiceViews();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & SendEmailRequest) => api.post<SendInvoiceResponse>(`/api/invoices/${id}/send-email`, body),
    onSuccess: invalidate,
  });
}

export function useSendInvoiceWhatsApp() {
  const invalidate = useInvalidateInvoiceViews();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & SendWhatsAppRequest) => api.post<SendInvoiceResponse>(`/api/invoices/${id}/send-whatsapp`, body),
    onSuccess: invalidate,
  });
}

const apiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const invoicePdfUrl = (id: string) => `${apiUrl()}/api/invoices/${id}/pdf`;
/** The quotation that travels with the invoice: revised with the agreed prices, or the original if unchanged. */
export const invoiceQuotationPdfUrl = (id: string) => `${apiUrl()}/api/invoices/${id}/quotation-pdf`;
