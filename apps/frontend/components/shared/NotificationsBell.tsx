"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { NotificationItem } from "@hpl/shared";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/lib/query/useNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const PRIORITY_DOT: Record<NotificationItem["priority"], string> = {
  CRITICAL: "bg-critical",
  HIGH: "bg-critical",
  MEDIUM: "bg-warning",
  LOW: "bg-text-muted",
};

export function NotificationsBell() {
  const router = useRouter();
  const unreadQuery = useUnreadNotificationCount();
  const listQuery = useNotifications({ pageSize: 8 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = unreadQuery.data ?? 0;
  const notifications = listQuery.data?.data ?? [];

  function handleSelect(n: NotificationItem) {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.linkModule) router.push(`/${n.linkModule.toLowerCase()}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="text-xs font-medium text-accent-strong hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-2.5 py-6 text-center text-xs text-text-muted">You&apos;re all caught up.</div>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem key={n.id} onSelect={() => handleSelect(n)} className="flex-col items-start gap-0.5">
              <div className="flex w-full items-start gap-2">
                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT[n.priority])} />
                <div className="flex-1">
                  <span className={cn("block text-sm", n.isRead ? "text-text-secondary" : "font-medium text-text-primary")}>
                    {n.title}
                  </span>
                  <span className="block text-xs text-text-muted">{n.message}</span>
                  <span className="block text-[11px] text-text-muted">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/notifications")} className="justify-center text-accent-strong">
          View all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
