"use client";

import { useState } from "react";
import { OrganizationSummary, ResetAdminPasswordResponse } from "@hpl/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useResetAdminPassword } from "@/lib/query/usePlatformAdmin";

const inputClass = "h-8 w-full rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent";

export function ResetAdminPasswordDialog({
  organization,
  onOpenChange,
  onReset,
}: {
  organization: OrganizationSummary;
  onOpenChange: (open: boolean) => void;
  onReset: (result: ResetAdminPasswordResponse) => void;
}) {
  const [customPassword, setCustomPassword] = useState("");
  const resetPassword = useResetAdminPassword();

  function handleConfirm() {
    resetPassword.mutate(
      { id: organization.id, password: customPassword || undefined },
      { onSuccess: (response) => onReset(response) },
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset admin password for {organization.name}?</DialogTitle>
          <DialogDescription>
            This immediately invalidates the current password — the admin will need the new one to log in again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 p-5">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">New password (optional — leave blank to auto-generate)</span>
            <input
              type="text"
              className={inputClass}
              minLength={8}
              placeholder="Auto-generated if left blank"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
            />
          </label>
          {resetPassword.isError && <p className="text-xs text-critical">{(resetPassword.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={resetPassword.isPending} onClick={handleConfirm}>
              {resetPassword.isPending ? "Resetting…" : "Reset password"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
