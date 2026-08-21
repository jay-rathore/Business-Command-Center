"use client";

import { AuthUserProvider } from "@/lib/auth/AuthUserContext";
import { AuthUser } from "@/lib/auth/types";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { Drawer } from "./Drawer";

export function AppShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return (
    <AuthUserProvider user={user}>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav />
          <main className="flex-1 overflow-y-auto bg-bg p-4 sm:p-6">{children}</main>
        </div>
      </div>
      <Drawer />
    </AuthUserProvider>
  );
}
