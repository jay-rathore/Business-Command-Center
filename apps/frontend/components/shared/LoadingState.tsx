import { cn } from "@/lib/utils";

export function LoadingState({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-4 animate-pulse rounded-sm bg-surface-2" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface p-4">
      <div className="h-3 w-20 animate-pulse rounded-sm bg-surface-2" />
      <div className="h-6 w-24 animate-pulse rounded-sm bg-surface-2" />
    </div>
  );
}
