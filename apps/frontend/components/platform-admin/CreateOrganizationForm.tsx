"use client";

import { useState } from "react";
import { CreateOrganizationRequest, CreateOrganizationResponse } from "@hpl/shared";
import { Button } from "@/components/ui/button";
import { useCreateOrganization } from "@/lib/query/usePlatformAdmin";
import { TemporaryPasswordDialog } from "./TemporaryPasswordDialog";

const inputClass = "h-8 w-full rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const BLANK: CreateOrganizationRequest = { name: "", slug: "", adminName: "", adminEmail: "" };

export function CreateOrganizationForm({ onCreated }: { onCreated?: () => void }) {
  const [value, setValue] = useState<CreateOrganizationRequest>(BLANK);
  const [slugTouched, setSlugTouched] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [result, setResult] = useState<CreateOrganizationResponse | null>(null);
  const create = useCreateOrganization();

  function patch(partial: Partial<CreateOrganizationRequest>) {
    setValue((prev) => ({ ...prev, ...partial }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = customPassword ? { ...value, password: customPassword } : value;
    create.mutate(payload, {
      onSuccess: (response) => {
        setResult(response);
        setValue(BLANK);
        setSlugTouched(false);
        setCustomPassword("");
        onCreated?.();
      },
    });
  }

  return (
    <>
      <form className="flex flex-col gap-3 rounded-sm border border-border p-3" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Organization name</span>
            <input
              className={inputClass}
              required
              value={value.name}
              onChange={(e) => {
                const name = e.target.value;
                patch({ name, slug: slugTouched ? value.slug : slugify(name) });
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Slug</span>
            <input
              className={inputClass}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={value.slug}
              onChange={(e) => {
                setSlugTouched(true);
                patch({ slug: e.target.value });
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Admin name</span>
            <input className={inputClass} required value={value.adminName} onChange={(e) => patch({ adminName: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Admin email</span>
            <input
              type="email"
              className={inputClass}
              required
              value={value.adminEmail}
              onChange={(e) => patch({ adminEmail: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Password (optional — leave blank to auto-generate)</span>
            <input
              type="text"
              className={inputClass}
              minLength={8}
              placeholder="Auto-generated if left blank"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
            />
          </label>
        </div>
        {create.isError && <p className="text-xs text-critical">{(create.error as Error).message}</p>}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create organization"}
          </Button>
        </div>
      </form>

      {result && (
        <TemporaryPasswordDialog
          open={!!result}
          onOpenChange={(open) => !open && setResult(null)}
          title={`${result.organization.name} created`}
          adminEmail={result.adminEmail}
          temporaryPassword={result.temporaryPassword}
        />
      )}
    </>
  );
}
