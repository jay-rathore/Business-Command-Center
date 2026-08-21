import { KanbanColumn, ProjectsKpis } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { ProjectsView } from "@/components/projects/ProjectsView";

export default async function ProjectsPage() {
  const [kpis, kanban] = await Promise.all([
    serverApiFetch<ProjectsKpis>("/api/projects/kpis"),
    serverApiFetch<KanbanColumn[]>("/api/projects/kanban"),
  ]);

  return <ProjectsView initialKpis={kpis} initialKanban={kanban} />;
}
