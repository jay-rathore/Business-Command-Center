"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { NotificationItem } from "@hpl/shared";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/query/useNotifications";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRIORITY_DOT: Record<NotificationItem["priority"], string> = {
  CRITICAL: "bg-critical",
  HIGH: "bg-critical",
  MEDIUM: "bg-warning",
  LOW: "bg-text-muted",
};

const FILTERS: { key: "ALL" | "UNREAD" | "READ"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "UNREAD", label: "Unread" },
  { key: "READ", label: "Read" },
];

export function NotificationsView() {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "READ">("ALL");
  const [page, setPage] = useState(1);
  const isRead = filter === "ALL" ? undefined : filter === "READ";

  const listQuery = useNotifications({ isRead, page, pageSize: 20 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  function handleClick(n: NotificationItem) {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.linkModule) router.push(`/${n.linkModule.toLowerCase()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-text-primary">Notifications</h1>
          <p className="text-sm text-text-muted">Missed follow-ups, at-risk dealers, high-value activity and more</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => markAllRead.mutate()}>
          Mark all as read
        </Button>
      </div>

      <div className="flex gap-1 rounded-sm border border-border p-0.5" style={{ width: "fit-content" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
            className={cn(
              "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
              filter === f.key ? "bg-accent-tint text-accent-strong" : "text-text-muted hover:text-text-primary",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="Nothing here" description="You're all caught up." />
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className="flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3 text-left hover:bg-surface-hover"
            >
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[n.priority])} />
              <div className="flex-1">
                <span className={cn("block text-sm", n.isRead ? "text-text-secondary" : "font-medium text-text-primary")}>
                  {n.title}
                </span>
                <span className="block text-xs text-text-muted">{n.message}</span>
                <span className="block text-[11px] text-text-muted">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
              </div>
              {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">
            Page {meta.page} of {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
