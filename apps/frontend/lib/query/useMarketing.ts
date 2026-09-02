"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CampaignDetail,
  CampaignListItem,
  CampaignPlatform,
  CampaignStatus,
  ChannelBreakdownEntry,
  MarketingKpis,
  PaginatedResponse,
} from "@hpl/shared";
import { api } from "../api/apiClient";
import { appendDateRange, DateRange } from "../dateRange";
import { TableState } from "@/hooks/useTableState";

function buildQuery(state: TableState & { platform?: CampaignPlatform; status?: CampaignStatus } & DateRange): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  if (state.platform) params.set("platform", state.platform);
  if (state.status) params.set("status", state.status);
  if (state.dateFrom) params.set("dateFrom", state.dateFrom);
  if (state.dateTo) params.set("dateTo", state.dateTo);
  return params.toString();
}

export function useMarketingList(
  state: TableState & { platform?: CampaignPlatform; status?: CampaignStatus } & DateRange,
  initialData?: PaginatedResponse<CampaignListItem>,
) {
  return useQuery({
    queryKey: ["marketing", "list", state],
    queryFn: () => api.get<PaginatedResponse<CampaignListItem>>(`/api/marketing?${buildQuery(state)}`),
    placeholderData: (prev) => prev,
    initialData:
      state.page === 1 && !state.sortBy && !state.q && !state.platform && !state.status && !state.dateFrom && !state.dateTo
        ? initialData
        : undefined,
  });
}

export function useMarketingKpis(range: DateRange = {}, initialData?: MarketingKpis) {
  return useQuery({
    queryKey: ["marketing", "kpis", range.dateFrom, range.dateTo],
    queryFn: () => api.get<MarketingKpis>(appendDateRange("/api/marketing/kpis", range)),
    initialData: !range.dateFrom && !range.dateTo ? initialData : undefined,
  });
}

export function useChannelBreakdown(range: DateRange = {}, initialData?: ChannelBreakdownEntry[]) {
  return useQuery({
    queryKey: ["marketing", "channel-breakdown", range.dateFrom, range.dateTo],
    queryFn: () => api.get<ChannelBreakdownEntry[]>(appendDateRange("/api/marketing/channel-breakdown", range)),
    initialData: !range.dateFrom && !range.dateTo ? initialData : undefined,
  });
}

export function useCampaignDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["marketing", "detail", id],
    queryFn: () => api.get<CampaignDetail>(`/api/marketing/${id}`),
    enabled: !!id,
  });
}

export function useRecomputeMetaSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ processed: number; created: number; updated: number }>("/api/marketing/meta-ads-sync/run"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing"] });
    },
  });
}

export function useRecomputeGoogleAdsSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ processed: number; created: number; updated: number }>("/api/marketing/google-ads-sync/run"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing"] });
    },
  });
}
