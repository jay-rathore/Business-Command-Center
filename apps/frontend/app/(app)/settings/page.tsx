import { ComingSoonPage } from "@/components/shared/ComingSoonPage";
import { CompanyProfilesSettings } from "@/components/settings/CompanyProfilesSettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <CompanyProfilesSettings />
      <IntegrationsSettings />
      <ComingSoonPage
        module="Settings & User Management"
        phase={3}
        description="Role-based user administration, granular permissions, and an audit log of every create/update/delete action."
      />
    </div>
  );
}
