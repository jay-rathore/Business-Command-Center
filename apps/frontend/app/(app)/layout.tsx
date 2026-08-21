import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/getServerUser";
import { AppShell } from "@/components/shared/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
