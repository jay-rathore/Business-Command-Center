export interface ReferralFeedItem {
  id: string;
  title: string;
  meta: string;
  value: string;
}

export function ReferralFeed({ items, onItemClick }: { items: ReferralFeedItem[]; onItemClick?: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const Comp = onItemClick ? "button" : "div";
        return (
          <Comp
            key={item.id}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            className="flex w-full items-center justify-between gap-3 rounded-sm border border-border px-3 py-2 text-left hover:bg-surface-hover"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-text-primary">{item.title}</span>
              <span className="block truncate text-xs text-text-muted">{item.meta}</span>
            </span>
            <span className="shrink-0 text-xs font-medium text-text-secondary">{item.value}</span>
          </Comp>
        );
      })}
    </div>
  );
}
