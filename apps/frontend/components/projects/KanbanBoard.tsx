import { KanbanColumn, ProjectListItem } from "@hpl/shared";
import { ProjectCard } from "./ProjectCard";
import { formatCurrency } from "@/lib/format";

export function KanbanBoard({ columns, onCardClick }: { columns: KanbanColumn[]; onCardClick: (project: ProjectListItem) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div key={col.stage} className="flex w-64 shrink-0 flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-text-primary">{col.label}</span>
            <span className="text-[11px] text-text-muted">{col.projects.length}</span>
          </div>
          <span className="px-1 text-[11px] text-text-muted">{formatCurrency(col.totalValue)}</span>
          <div className="flex min-h-24 flex-col gap-2 rounded-md bg-surface-2 p-2">
            {col.projects.length === 0 ? (
              <span className="px-1 py-6 text-center text-[11px] text-text-muted">No projects</span>
            ) : (
              col.projects.map((p) => <ProjectCard key={p.id} project={p} onClick={() => onCardClick(p)} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
