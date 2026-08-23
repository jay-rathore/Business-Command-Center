"use client";

import { useState } from "react";
import { OrganizationSummary, ResetAdminPasswordResponse } from "@hpl/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/lib/auth/AuthUserContext";
import { useOrganizations, useSetOrganizationActive } from "@/lib/query/usePlatformAdmin";
import { CreateOrganizationForm } from "./CreateOrganizationForm";
import { EditOrganizationForm } from "./EditOrganizationForm";
import { ResetAdminPasswordDialog } from "./ResetAdminPasswordDialog";
import { TemporaryPasswordDialog } from "./TemporaryPasswordDialog";

export function OrganizationsPanel() {
  const currentUser = useAuthUser();
  const organizations = useOrganizations();
  const setActive = useSetOrganizationActive();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resettingOrg, setResettingOrg] = useState<OrganizationSummary | null>(null);
  const [resetResult, setResetResult] = useState<ResetAdminPasswordResponse | null>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>Every tenant on this platform, and their basic usage.</CardDescription>
        </div>
        {!creating && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setCreating(true)}>
            + New Organization
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {creating && <CreateOrganizationForm onCreated={() => setCreating(false)} />}

        {organizations.data?.map((org: OrganizationSummary) => {
          const isOwnOrg = org.id === currentUser.organizationId;
          return editingId === org.id ? (
            <EditOrganizationForm key={org.id} organization={org} onDone={() => setEditingId(null)} />
          ) : (
            <div key={org.id} className="flex items-center justify-between gap-3 rounded-sm border border-border p-3 text-xs">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{org.name}</span>
                  <span className="text-text-muted">{org.slug}</span>
                  <Badge variant={org.isActive ? "good" : "critical"}>{org.isActive ? "Active" : "Suspended"}</Badge>
                  {isOwnOrg && <Badge variant="accent">Your organization</Badge>}
                </div>
                <span className="text-text-muted">
                  {org.userCount} user{org.userCount === 1 ? "" : "s"} · {org.leadCount} lead{org.leadCount === 1 ? "" : "s"} ·
                  created {new Date(org.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!isOwnOrg && (
                  <>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setResettingOrg(org)}>
                      Reset admin password
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={setActive.isPending}
                      onClick={() => setActive.mutate({ id: org.id, isActive: !org.isActive })}
                    >
                      {org.isActive ? "Suspend" : "Reactivate"}
                    </Button>
                  </>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(org.id)}>
                  Edit
                </Button>
              </div>
            </div>
          );
        })}

        {organizations.data && organizations.data.length === 0 && !creating && (
          <p className="text-xs text-text-muted">No organizations yet.</p>
        )}
      </CardContent>

      {resettingOrg && (
        <ResetAdminPasswordDialog
          organization={resettingOrg}
          onOpenChange={(open) => !open && setResettingOrg(null)}
          onReset={(result) => {
            setResettingOrg(null);
            setResetResult(result);
          }}
        />
      )}

      {resetResult && (
        <TemporaryPasswordDialog
          open={!!resetResult}
          onOpenChange={(open) => !open && setResetResult(null)}
          title="Admin password reset"
          adminEmail={resetResult.adminEmail}
          temporaryPassword={resetResult.temporaryPassword}
        />
      )}
    </Card>
  );
}
