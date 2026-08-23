"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { InvestigationQuery, TrafficEventDetail, TrafficInvestigationResult, TrafficOverview, TrafficTimelineEvent } from "@hpl/shared";
import { api } from "../api/apiClient";

export interface TrafficDateRange {
  dateFrom?: string;
  dateTo?: string;
}

function rangeQueryString(range: TrafficDateRange): string {
  const params = new URLSearchParams();
  if (range.dateFrom) params.set("dateFrom", range.dateFrom);
  if (range.dateTo) params.set("dateTo", range.dateTo);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useTrafficOverview(range: TrafficDateRange) {
  return useQuery({
    queryKey: ["marketing", "traffic-intelligence", "overview", range.dateFrom, range.dateTo],
    queryFn: () => api.get<TrafficOverview>(`/api/marketing/traffic-intelligence/overview${rangeQueryString(range)}`),
  });
}

export function useTrafficTimeline(range: TrafficDateRange) {
  return useQuery({
    queryKey: ["marketing", "traffic-intelligence", "timeline", range.dateFrom, range.dateTo],
    queryFn: () => api.get<TrafficTimelineEvent[]>(`/api/marketing/traffic-intelligence/timeline${rangeQueryString(range)}`),
  });
}

export function useTrafficEventDetail(id: string | null) {
  return useQuery({
    queryKey: ["marketing", "traffic-intelligence", "event", id],
    queryFn: () => api.get<TrafficEventDetail>(`/api/marketing/traffic-intelligence/events/${id}`),
    enabled: id !== null,
  });
}

export function useInvestigateTraffic() {
  return useMutation({
    mutationFn: (query: InvestigationQuery) => api.post<TrafficInvestigationResult>("/api/marketing/traffic-intelligence/investigate", query),
  });
}
