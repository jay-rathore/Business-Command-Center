"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  KanbanColumn,
  PaginatedResponse,
  ProjectDetail,
  ProjectListItem,
  ProjectsKpis,
  ProjectStage,
  StageDistributionEntry,
} from "@hpl/shared";
import { api } from "../api/apiClient";
import { TableState } from "@/hooks/useTableState";

function buildQuery(state: TableState & { stage?: ProjectStage }): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  if (state.q) params.set("q", state.q);
  if (state.stage) params.set("stage", state.stage);
  return params.toString();
}

export function useProjectsList(state: TableState & { stage?: ProjectStage }) {
  return useQuery({
    queryKey: ["projects", "list", state],
    queryFn: () => api.get<PaginatedResponse<ProjectListItem>>(`/api/projects?${buildQuery(state)}`),
    placeholderData: (prev) => prev,
  });
}

export function useProjectsKanban(initialData?: KanbanColumn[]) {
  return useQuery({
    queryKey: ["projects", "kanban"],
    queryFn: () => api.get<KanbanColumn[]>("/api/projects/kanban"),
    initialData,
  });
}

export function useProjectsKpis(initialData?: ProjectsKpis) {
  return useQuery({
    queryKey: ["projects", "kpis"],
    queryFn: () => api.get<ProjectsKpis>("/api/projects/kpis"),
    initialData,
  });
}

export function useProjectsStageDistribution() {
  return useQuery({
    queryKey: ["projects", "stage-distribution"],
    queryFn: () => api.get<StageDistributionEntry[]>("/api/projects/stage-distribution"),
  });
}

export function useProjectsStuck() {
  return useQuery({
    queryKey: ["projects", "stuck"],
    queryFn: () => api.get<ProjectListItem[]>("/api/projects/stuck"),
  });
}

export function useProjectsClosingSoon() {
  return useQuery({
    queryKey: ["projects", "closing-soon"],
    queryFn: () => api.get<ProjectListItem[]>("/api/projects/closing-soon"),
  });
}

export function useProjectDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["projects", "detail", id],
    queryFn: () => api.get<ProjectDetail>(`/api/projects/${id}`),
    enabled: !!id,
  });
}

export function useUpdateProjectStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, toStage, note }: { id: string; toStage: ProjectStage; note?: string }) =>
      api.patch<ProjectDetail>(`/api/projects/${id}/stage`, { toStage, note }),
    onSuccess: (data) => {
      queryClient.setQueryData(["projects", "detail", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
