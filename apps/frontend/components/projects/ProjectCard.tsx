import { ProjectListItem } from "@hpl/shared";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";

export function ProjectCard({ project, onClick }: { project: ProjectListItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col gap-2 rounded-md border border-border bg-surface p-3 text-left shadow-(--shadow-sm) transition-shadow hover:shadow-(--shadow-md)"
    >
      <span className="line-clamp-2 text-xs font-medium text-text-primary">{project.name}</span>
      <span className="text-sm font-semibold text-text-primary">{formatCurrency(project.estimatedValue)}</span>
      {(project.isStuck || project.isClosingSoon) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {project.isStuck && <Badge variant="critical">Stuck</Badge>}
          {project.isClosingSoon && <Badge variant="warning">Closing Soon</Badge>}
        </div>
      )}
      <span className="text-[11px] text-text-muted">
        {project.probability}% · {project.city}
      </span>
    </button>
  );
}
