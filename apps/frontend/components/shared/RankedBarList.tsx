export interface RankedBarEntry {
  label: string;
  value: number;
  displayValue: string;
}

export function RankedBarList({ entries }: { entries: RankedBarEntry[] }) {
  const max = Math.max(...entries.map((e) => e.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {entries.map((e) => (
        <div key={e.label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">{e.label}</span>
            <span className="font-medium text-text-primary">{e.displayValue}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(2, (e.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
