"use client";

import { useState } from "react";
import { IntegrationProvider } from "@hpl/shared";
import { Button } from "@/components/ui/button";

interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "password" | "number";
  optional?: boolean;
}

// Field names match exactly what each sync/send service reads off the decrypted credentials
// object (see apps/backend/src/integration-connections/credential-types.ts) — keep in sync.
const PROVIDER_FIELDS: Record<IntegrationProvider, FieldDef[]> = {
  META_ADS: [
    { key: "adAccountId", label: "Ad Account ID" },
    { key: "accessToken", label: "Access Token", type: "password" },
  ],
  GOOGLE_ADS: [
    { key: "clientId", label: "OAuth Client ID" },
    { key: "clientSecret", label: "OAuth Client Secret", type: "password" },
    { key: "developerToken", label: "Developer Token", type: "password" },
    { key: "customerId", label: "Customer ID" },
    { key: "loginCustomerId", label: "Login Customer ID (MCC, optional)", optional: true },
    { key: "refreshToken", label: "Refresh Token", type: "password" },
  ],
  GOOGLE_ANALYTICS: [
    { key: "propertyId", label: "GA4 Property ID" },
    { key: "serviceAccountEmail", label: "Service Account Email" },
    { key: "serviceAccountPrivateKey", label: "Service Account Private Key", type: "password" },
  ],
  SEARCH_CONSOLE: [
    { key: "siteUrl", label: "Site URL" },
    { key: "serviceAccountEmail", label: "Service Account Email" },
    { key: "serviceAccountPrivateKey", label: "Service Account Private Key", type: "password" },
  ],
  WOOCOMMERCE: [
    { key: "url", label: "Store URL" },
    { key: "consumerKey", label: "Consumer Key" },
    { key: "consumerSecret", label: "Consumer Secret", type: "password" },
  ],
  WHATSAPP: [
    { key: "phoneNumberId", label: "Phone Number ID" },
    { key: "businessAccountId", label: "Business Account ID" },
    { key: "accessToken", label: "Access Token", type: "password" },
    { key: "apiVersion", label: "API Version (optional, e.g. v21.0)", optional: true },
  ],
  EMAIL_SMTP: [
    { key: "host", label: "SMTP Host" },
    { key: "port", label: "SMTP Port", type: "number" },
    { key: "user", label: "SMTP Username" },
    { key: "pass", label: "SMTP Password", type: "password" },
    { key: "fromAddress", label: "From Address" },
    { key: "fromName", label: "From Name (optional)", optional: true },
  ],
};

const inputClass = "h-8 w-full rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent";

/** Credentials are write-only — once saved, the backend never returns them (see
 * IntegrationConnectionsController), so this form always starts blank even when editing an
 * already-configured provider. Re-entering every field is a deliberate simplification: it
 * keeps "edit" and "add" the same form instead of needing a separate partial-update flow. */
export function IntegrationConnectionForm({
  provider,
  onSubmit,
  onCancel,
  submitting,
}: {
  provider: IntegrationProvider;
  onSubmit: (credentials: Record<string, string | number | boolean>) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const fields = PROVIDER_FIELDS[provider];
  const [values, setValues] = useState<Record<string, string>>({});

  function patch(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const credentials: Record<string, string | number | boolean> = {};
    for (const field of fields) {
      const raw = values[field.key] ?? "";
      if (!raw && field.optional) continue;
      credentials[field.key] = field.type === "number" ? Number(raw) : raw;
    }
    if (provider === "EMAIL_SMTP") {
      // secure isn't user-editable here (deliberately minimal form) — 465 implies implicit TLS.
      credentials.secure = Number(credentials.port) === 465;
    }
    onSubmit(credentials);
  }

  return (
    <form className="flex flex-col gap-3 rounded-sm border border-border p-3" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => (
          <label key={field.key} className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">{field.label}</span>
            <input
              className={inputClass}
              type={field.type === "number" ? "number" : field.type === "password" ? "password" : "text"}
              required={!field.optional}
              value={values[field.key] ?? ""}
              onChange={(e) => patch(field.key, e.target.value)}
              autoComplete="off"
            />
          </label>
        ))}
      </div>
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
