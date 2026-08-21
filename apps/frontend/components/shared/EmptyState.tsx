import { type LucideIcon } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {Icon && <Icon className="h-7 w-7 text-text-muted" />}
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description && <p className="max-w-xs text-xs text-text-muted">{description}</p>}
    </div>
  );
}
