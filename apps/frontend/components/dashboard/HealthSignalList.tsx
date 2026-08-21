import { CheckCircle2, AlertTriangle, AlertCircle, Clock } from "lucide-react";
import { BusinessHealthSignal, HealthStatus } from "@hpl/shared";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<HealthStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  good: { icon: CheckCircle2, color: "text-good", label: "Healthy" },
  warn: { icon: AlertTriangle, color: "text-warning", label: "Warning" },
  crit: { icon: AlertCircle, color: "text-critical", label: "Critical" },
  pending: { icon: Clock, color: "text-text-muted", label: "Not yet tracked" },
};

export function HealthSignalList({ signals }: { signals: BusinessHealthSignal[] }) {
  return (
    <div className="flex flex-col gap-3">
      {signals.map((s) => {
        const config = STATUS_CONFIG[s.status];
        const Icon = config.icon;
        return (
          <div key={s.key} className="flex items-start gap-3 rounded-sm border border-border p-3">
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.color)} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text-primary">{s.name}</span>
                <span className={cn("shrink-0 text-xs font-medium", config.color)}>{config.label}</span>
              </div>
              <p className="mt-0.5 text-xs text-text-muted">{s.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
