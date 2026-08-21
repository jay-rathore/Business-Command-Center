"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/apiClient";
import { AuthUser } from "./types";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

export function useCurrentUser(initialData?: AuthUser | null) {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => api.get<AuthUser>("/api/auth/me"),
    initialData,
    retry: false,
  });
}

interface LoginResponse {
  user: { id: string; email: string; role: string; permissions: string[] };
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (creds: { email: string; password: string }) => api.post<LoginResponse>("/api/auth/login", creds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/auth/logout"),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
    },
  });
}
