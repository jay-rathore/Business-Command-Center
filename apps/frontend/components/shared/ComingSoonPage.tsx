import { Clock } from "lucide-react";

export function ComingSoonPage({
  module,
  phase,
  description,
}: {
  module: string;
  phase: 2 | 3 | 4;
  description: string;
}) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-tint text-accent-strong">
        <Clock className="h-6 w-6" />
      </div>
      <h2 className="font-display text-lg font-semibold text-text-primary">{module}</h2>
      <p className="max-w-sm text-sm text-text-muted">{description}</p>
      <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-text-secondary">
        Planned for Phase {phase}
      </span>
    </div>
  );
}
