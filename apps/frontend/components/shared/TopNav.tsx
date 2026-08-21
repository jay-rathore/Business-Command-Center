"use client";

import { useRouter } from "next/navigation";
import { Search, Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { useAuthUser } from "@/lib/auth/AuthUserContext";
import { useLogout } from "@/lib/auth/useAuth";
import { formatRoleName, initials } from "@/lib/utils";
import { useUiStore } from "@/lib/stores/uiStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopNav() {
  const user = useAuthUser();
  const router = useRouter();
  const logout = useLogout();
  const openMobileSidebar = useUiStore((s) => s.openMobileSidebar);

  async function handleLogout() {
    await logout.mutateAsync();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 sm:gap-4 sm:px-5">
      <button
        type="button"
        onClick={openMobileSidebar}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex flex-1 items-center gap-2 rounded-sm border border-border bg-bg px-3 py-1.5 text-sm text-text-muted">
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden truncate sm:inline">Search leads, dealers, projects, orders…</span>
        <span className="truncate sm:hidden">Search…</span>
      </div>

      <button
        type="button"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex shrink-0 items-center gap-2 rounded-sm py-1 pl-1 pr-2 hover:bg-surface-hover">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-xs font-semibold text-accent-strong">
              {initials(user.name)}
            </span>
            <span className="hidden flex-col items-start leading-tight sm:flex">
              <span className="text-sm font-medium text-text-primary">{user.name}</span>
              <span className="text-xs text-text-muted">{formatRoleName(user.role)}</span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-text-muted sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleLogout}>
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
