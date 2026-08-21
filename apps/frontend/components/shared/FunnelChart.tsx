export interface FunnelStageDatum {
  label: string;
  count: number;
}

export function FunnelChart({ stages }: { stages: FunnelStageDatum[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {stages.map((stage, i) => {
        const widthPct = Math.max(4, (stage.count / max) * 100);
        const prevCount = i > 0 ? stages[i - 1].count : null;
        const dropOffPct = prevCount && prevCount > 0 ? ((prevCount - stage.count) / prevCount) * 100 : null;
        return (
          <div key={stage.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-text-secondary">{stage.label}</span>
            <div className="h-7 flex-1 rounded-sm bg-surface-2">
              <div
                className="flex h-full items-center rounded-sm bg-accent px-2 text-xs font-medium text-white transition-all"
                style={{ width: `${widthPct}%` }}
              >
                {stage.count}
              </div>
            </div>
            <span className="w-16 shrink-0 text-right text-[11px] text-text-muted">
              {dropOffPct !== null ? `-${dropOffPct.toFixed(0)}%` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
