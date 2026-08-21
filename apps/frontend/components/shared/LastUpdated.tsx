"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function LastUpdated({
  timestamp,
  onRefresh,
  isRefreshing,
}: {
  timestamp: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!timestamp) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      <span>Last updated: {formatAge(Date.now() - timestamp)}</span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center text-text-muted hover:text-accent disabled:opacity-50"
          aria-label="Refresh"
        >
          <RotateCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
        </button>
      )}
    </div>
  );
}
