"use client";

import { useState } from "react";
import { OrganizationSummary } from "@hpl/shared";
import { Button } from "@/components/ui/button";
import { useUpdateOrganization } from "@/lib/query/usePlatformAdmin";

const inputClass = "h-8 w-full rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent";

export function EditOrganizationForm({ organization, onDone }: { organization: OrganizationSummary; onDone: () => void }) {
  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const update = useUpdateOrganization();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({ id: organization.id, name, slug }, { onSuccess: onDone });
  }

  return (
    <form className="flex flex-col gap-3 rounded-sm border border-border p-3" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Organization name</span>
          <input className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Slug</span>
          <input
            className={inputClass}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
      </div>
      {update.isError && <p className="text-xs text-critical">{(update.error as Error).message}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
