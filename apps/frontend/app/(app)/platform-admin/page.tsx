import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/getServerUser";
import { OrganizationsPanel } from "@/components/platform-admin/OrganizationsPanel";

export default async function PlatformAdminPage() {
  const user = await getServerUser();

  // (app)/layout.tsx already redirects logged-out users to /login before this renders — this
  // only needs to additionally gate on the platform-admin flag itself.
  if (!user?.isPlatformAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <OrganizationsPanel />
    </div>
  );
}
