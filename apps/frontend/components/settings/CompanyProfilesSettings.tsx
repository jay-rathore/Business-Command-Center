"use client";

import { useState } from "react";
import { CompanyProfile, RoleName, UpsertCompanyProfileRequest } from "@hpl/shared";
import { useAuthUser } from "@/lib/auth/AuthUserContext";
import { useCompanyProfiles, useCreateCompanyProfile, useUpdateCompanyProfile } from "@/lib/query/useCompanyProfiles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyProfileForm } from "./CompanyProfileForm";

export function CompanyProfilesSettings() {
  const user = useAuthUser();
  const canManage = user.role === RoleName.OWNER || user.role === RoleName.ADMIN;

  const profiles = useCompanyProfiles(canManage);
  const create = useCreateCompanyProfile();
  const update = useUpdateCompanyProfile();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!canManage) return null;

  function handleCreate(value: UpsertCompanyProfileRequest) {
    create.mutate(value, { onSuccess: () => setCreating(false) });
  }

  function handleUpdate(id: string, value: UpsertCompanyProfileRequest) {
    update.mutate({ id, ...value }, { onSuccess: () => setEditingId(null) });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Company Profile Templates</CardTitle>
          <CardDescription>Letterhead, GSTIN, and bank details used when generating quotations.</CardDescription>
        </div>
        {!creating && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setCreating(true)}>
            + New Template
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {creating && (
          <CompanyProfileForm onSubmit={handleCreate} onCancel={() => setCreating(false)} submitting={create.isPending} />
        )}

        {profiles.data?.map((profile: CompanyProfile) =>
          editingId === profile.id ? (
            <CompanyProfileForm
              key={profile.id}
              initial={profile}
              onSubmit={(value) => handleUpdate(profile.id, value)}
              onCancel={() => setEditingId(null)}
              submitting={update.isPending}
            />
          ) : (
            <div key={profile.id} className="flex items-center justify-between gap-3 rounded-sm border border-border p-3 text-xs">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{profile.label}</span>
                  {profile.isDefault && <Badge variant="accent">Default</Badge>}
                  {!profile.isActive && <Badge variant="neutral">Inactive</Badge>}
                </div>
                <span className="text-text-muted">{profile.name} · GSTIN {profile.gstin}</span>
                <span className="text-text-muted">{profile.bankName} · A/C {profile.bankAccountNumber}</span>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(profile.id)}>
                Edit
              </Button>
            </div>
          ),
        )}

        {profiles.data && profiles.data.length === 0 && !creating && (
          <p className="text-xs text-text-muted">No company profile templates yet — add one to start generating quotations.</p>
        )}
      </CardContent>
    </Card>
  );
}
