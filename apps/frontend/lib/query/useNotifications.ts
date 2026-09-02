"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotificationItem, PaginatedResponse } from "@hpl/shared";
import { api } from "../api/apiClient";

export interface NotificationsFilter {
  isRead?: boolean;
  page?: number;
  pageSize?: number;
}

function buildQuery(filter: NotificationsFilter): string {
  const params = new URLSearchParams();
  params.set("page", String(filter.page ?? 1));
  params.set("pageSize", String(filter.pageSize ?? 20));
  if (filter.isRead !== undefined) params.set("isRead", String(filter.isRead));
  return params.toString();
}

export function useNotifications(filter: NotificationsFilter = {}) {
  return useQuery({
    queryKey: ["notifications", "list", filter],
    queryFn: () => api.get<PaginatedResponse<NotificationItem>>(`/api/notifications?${buildQuery(filter)}`),
    placeholderData: (prev) => prev,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.get<number>("/api/notifications/unread-count"),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch<void>(`/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
