"use client";

import { usePathname } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { AuthUserProvider } from "@/lib/auth/AuthUserContext";
import { AuthUser } from "@/lib/auth/types";
import { canAccess } from "@/lib/auth/route-access";
import { EmptyState } from "./EmptyState";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { Drawer } from "./Drawer";

export function AppShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AuthUserProvider user={user}>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav />
          <main className="flex-1 overflow-y-auto bg-bg p-4 sm:p-6">{canAccess(user, pathname) ? (
              children
            ) : (
              <EmptyState
                icon={ShieldOff}
                title="Access denied"
                description="Your role doesn't have permission to view this page. Ask an administrator if you need access."
              />
            )}
          </main>
        </div>
      </div>
      <Drawer />
    </AuthUserProvider>
  );
}
