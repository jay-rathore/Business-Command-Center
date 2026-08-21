import { cn, initials } from "@/lib/utils";

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  primaryValue: string;
  secondaryLabel?: string;
}

const RANK_BADGE: Record<number, string> = {
  1: "bg-[#F1C744] text-[#5C4400]",
  2: "bg-[#C9D0D8] text-[#33424F]",
  3: "bg-[#D8A26B] text-[#5A3410]",
};

export function Leaderboard({ entries, onEntryClick }: { entries: LeaderboardEntry[]; onEntryClick?: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {entries.map((e) => {
        const Comp = onEntryClick ? "button" : "div";
        return (
          <Comp
            key={e.id}
            onClick={onEntryClick ? () => onEntryClick(e.id) : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left",
              onEntryClick && "hover:bg-surface-hover",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                RANK_BADGE[e.rank] ?? "bg-surface-2 text-text-muted",
              )}
            >
              {e.rank}
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-xs font-semibold text-accent-strong">
              {initials(e.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text-primary">{e.name}</span>
              {e.secondaryLabel && <span className="block truncate text-xs text-text-muted">{e.secondaryLabel}</span>}
            </span>
            <span className="shrink-0 text-sm font-semibold text-text-primary">{e.primaryValue}</span>
          </Comp>
        );
      })}
    </div>
  );
}
