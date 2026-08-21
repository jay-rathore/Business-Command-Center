"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_MODULES } from "@hpl/shared";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  FileText,
  Megaphone,
  UserCog,
  Store,
  Compass,
  HardHat,
  FolderKanban,
  Contact,
  MessageSquareWarning,
  ShieldCheck,
  Package,
  Map,
  Sparkles,
  Bell,
  FileBarChart,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/lib/stores/uiStore";

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  sales: TrendingUp,
  leads: Users,
  quotations: FileText,
  marketing: Megaphone,
  "sales-team": UserCog,
  dealers: Store,
  architects: Compass,
  builders: HardHat,
  projects: FolderKanban,
  customers: Contact,
  complaints: MessageSquareWarning,
  warranty: ShieldCheck,
  products: Package,
  geography: Map,
  "ai-insights": Sparkles,
  notifications: Bell,
  reports: FileBarChart,
  settings: Settings,
};

export function Sidebar() {
  const pathname = usePathname();
  const isMobileOpen = useUiStore((s) => s.isMobileSidebarOpen);
  const closeMobile = useUiStore((s) => s.closeMobileSidebar);

  // Close the off-canvas drawer on every route change (mobile UX expectation).
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={closeMobile} aria-hidden="true" />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200",
          "md:static md:z-auto md:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent text-xs font-bold text-white">
            HM
          </div>
          <span className="font-display text-sm font-semibold text-text-primary">HPL Maker</span>
          <button
            type="button"
            onClick={closeMobile}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface-hover md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="flex flex-col gap-0.5">
            {NAV_MODULES.map((mod) => {
              const Icon = NAV_ICONS[mod.key] ?? LayoutDashboard;
              const isActive = pathname === mod.route || pathname.startsWith(`${mod.route}/`);
              const isComingSoon = mod.phase > 1;

              return (
                <li key={mod.key}>
                  <Link
                    href={mod.route}
                    className={cn(
                      "flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-accent-tint font-medium text-accent-strong"
                        : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{mod.label}</span>
                    {isComingSoon && (
                      <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                        Soon
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
