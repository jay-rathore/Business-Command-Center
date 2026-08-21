"use client";

import { useState } from "react";
import { CompanyProfile, UpsertCompanyProfileRequest } from "@hpl/shared";
import { Button } from "@/components/ui/button";

const inputClass = "h-8 w-full rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-text-muted">{label}</span>
      {children}
    </label>
  );
}

const BLANK: UpsertCompanyProfileRequest = {
  label: "",
  isDefault: false,
  isActive: true,
  name: "",
  addressLine1: "",
  addressLine2: null,
  city: "",
  state: "",
  phone: "",
  email: null,
  gstin: "",
  logoDataUrl: null,
  bankName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankSwift: null,
  defaultTermsAndConditions: "",
  defaultAdvancePercent: 50,
  defaultBeforeDispatchPercent: 50,
  validityDays: 30,
};

export function CompanyProfileForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: CompanyProfile;
  onSubmit: (value: UpsertCompanyProfileRequest) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [value, setValue] = useState<UpsertCompanyProfileRequest>(initial ?? BLANK);

  function patch(partial: Partial<UpsertCompanyProfileRequest>) {
    setValue((prev) => ({ ...prev, ...partial }));
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-sm border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Template label">
          <input className={inputClass} required value={value.label} onChange={(e) => patch({ label: e.target.value })} />
        </Field>
        <Field label="Company name">
          <input className={inputClass} required value={value.name} onChange={(e) => patch({ name: e.target.value })} />
        </Field>
        <Field label="Address line 1">
          <input className={inputClass} required value={value.addressLine1} onChange={(e) => patch({ addressLine1: e.target.value })} />
        </Field>
        <Field label="Address line 2">
          <input className={inputClass} value={value.addressLine2 ?? ""} onChange={(e) => patch({ addressLine2: e.target.value || null })} />
        </Field>
        <Field label="City">
          <input className={inputClass} required value={value.city} onChange={(e) => patch({ city: e.target.value })} />
        </Field>
        <Field label="State">
          <input className={inputClass} required value={value.state} onChange={(e) => patch({ state: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className={inputClass} required value={value.phone} onChange={(e) => patch({ phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputClass} value={value.email ?? ""} onChange={(e) => patch({ email: e.target.value || null })} />
        </Field>
        <Field label="GSTIN">
          <input className={inputClass} required value={value.gstin} onChange={(e) => patch({ gstin: e.target.value })} />
        </Field>
        <Field label="Bank name">
          <input className={inputClass} required value={value.bankName} onChange={(e) => patch({ bankName: e.target.value })} />
        </Field>
        <Field label="Account number">
          <input className={inputClass} required value={value.bankAccountNumber} onChange={(e) => patch({ bankAccountNumber: e.target.value })} />
        </Field>
        <Field label="IFSC">
          <input className={inputClass} required value={value.bankIfsc} onChange={(e) => patch({ bankIfsc: e.target.value })} />
        </Field>
        <Field label="SWIFT (optional)">
          <input className={inputClass} value={value.bankSwift ?? ""} onChange={(e) => patch({ bankSwift: e.target.value || null })} />
        </Field>
        <Field label="Default advance %">
          <input
            type="number"
            min={0}
            max={100}
            className={inputClass}
            value={value.defaultAdvancePercent}
            onChange={(e) => {
              const p = Math.min(100, Math.max(0, Number(e.target.value) || 0));
              patch({ defaultAdvancePercent: p, defaultBeforeDispatchPercent: 100 - p });
            }}
          />
        </Field>
        <Field label="Validity (days)">
          <input
            type="number"
            min={1}
            className={inputClass}
            value={value.validityDays}
            onChange={(e) => patch({ validityDays: Number(e.target.value) || 1 })}
          />
        </Field>
      </div>

      <Field label="Default terms & conditions (one per line)">
        <textarea
          rows={4}
          className="resize-none rounded-sm border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
          value={value.defaultTermsAndConditions}
          onChange={(e) => patch({ defaultTermsAndConditions: e.target.value })}
        />
      </Field>

      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <input type="checkbox" checked={value.isDefault} onChange={(e) => patch({ isDefault: e.target.checked })} />
        Make this the default template
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
