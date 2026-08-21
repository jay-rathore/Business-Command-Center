import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  delta?: string;
  deltaTone?: "good" | "critical" | "neutral";
  sub?: string;
  onClick?: () => void;
}

export function KpiCard({ label, value, icon: Icon, delta, deltaTone = "neutral", sub, onClick }: KpiCardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 rounded-md border border-border bg-surface p-4 text-left shadow-(--shadow-sm)",
        onClick && "cursor-pointer transition-shadow hover:shadow-(--shadow-md)",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-text-muted" />}
      </div>
      <span className="font-display text-xl font-semibold text-text-primary">{value}</span>
      {(delta || sub) && (
        <div className="flex items-center gap-1.5 text-xs">
          {delta && (
            <span
              className={cn(
                "font-medium",
                deltaTone === "good" && "text-good",
                deltaTone === "critical" && "text-critical",
                deltaTone === "neutral" && "text-text-muted",
              )}
            >
              {delta}
            </span>
          )}
          {sub && <span className="text-text-muted">{sub}</span>}
        </div>
      )}
    </Comp>
  );
}
