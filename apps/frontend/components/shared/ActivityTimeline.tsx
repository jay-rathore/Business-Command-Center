export interface TimelineEntry {
  id: string;
  type: string;
  note: string | null;
  performedByName: string | null;
  occurredAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  WHATSAPP: "WhatsApp",
  SITE_VISIT: "Site Visit",
  NOTE: "Note",
  STATUS_CHANGE: "Status Change",
  FOLLOW_UP_SCHEDULED: "Follow-up Scheduled",
  SAMPLE_SENT: "Sample Sent",
  QUOTE_SENT: "Quote Sent",
  ORDER_PLACED: "Order Placed",
};

export function ActivityTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-text-muted">No activity logged yet.</p>;
  }

  return (
    <div className="flex flex-col">
      {entries.map((e, i) => (
        <div key={e.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
            {i < entries.length - 1 && <span className="w-px flex-1 bg-border" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-text-primary">{TYPE_LABEL[e.type] ?? e.type}</span>
              <span className="shrink-0 text-[11px] text-text-muted">
                {new Date(e.occurredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>
            {e.note && <p className="mt-0.5 text-xs text-text-secondary">{e.note}</p>}
            {e.performedByName && <p className="mt-0.5 text-[11px] text-text-muted">by {e.performedByName}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
