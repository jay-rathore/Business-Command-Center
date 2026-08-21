import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AttentionFeedItem {
  id: string;
  title: string;
  meta: string;
  value: string;
  priority: "critical" | "high" | "medium";
}

const PRIORITY_COLOR: Record<AttentionFeedItem["priority"], string> = {
  critical: "text-critical",
  high: "text-warning",
  medium: "text-text-muted",
};

export function AttentionFeed({ items, onItemClick }: { items: AttentionFeedItem[]; onItemClick?: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onItemClick?.(item.id)}
          className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2 text-left hover:bg-surface-hover"
        >
          <span className="flex items-center gap-2 text-xs">
            <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", PRIORITY_COLOR[item.priority])} />
            <span>
              <span className="block font-medium text-text-primary">{item.title}</span>
              <span className="block text-text-muted">{item.meta}</span>
            </span>
          </span>
          <span className={cn("shrink-0 text-xs font-medium", PRIORITY_COLOR[item.priority])}>{item.value}</span>
        </button>
      ))}
    </div>
  );
}
