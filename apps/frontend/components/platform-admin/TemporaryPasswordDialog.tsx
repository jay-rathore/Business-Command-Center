"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function TemporaryPasswordDialog({
  open,
  onOpenChange,
  title,
  adminEmail,
  temporaryPassword,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  adminEmail: string;
  temporaryPassword: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            This temporary password is shown once and cannot be retrieved again — copy it now and relay it to the
            client's admin securely.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 p-5 text-xs">
          <span className="text-text-muted">Admin login</span>
          <span className="font-medium text-text-primary">{adminEmail}</span>
          <span className="mt-2 text-text-muted">Temporary password</span>
          <code className="rounded-sm border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm text-text-primary">
            {temporaryPassword}
          </code>
        </div>
      </DialogContent>
    </Dialog>
  );
}
