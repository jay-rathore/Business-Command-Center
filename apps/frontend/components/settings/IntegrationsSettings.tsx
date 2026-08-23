"use client";

import { useState } from "react";
import { IntegrationConnectionSummary, IntegrationProvider, RoleName } from "@hpl/shared";
import { useAuthUser } from "@/lib/auth/AuthUserContext";
import {
  useIntegrationConnections,
  useSetIntegrationConnectionActive,
  useUpsertIntegrationConnection,
} from "@/lib/query/useIntegrationConnections";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntegrationConnectionForm } from "./IntegrationConnectionForm";

const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  META_ADS: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  GOOGLE_ANALYTICS: "Google Analytics (GA4)",
  SEARCH_CONSOLE: "Search Console",
  WOOCOMMERCE: "WooCommerce",
  WHATSAPP: "WhatsApp",
  EMAIL_SMTP: "Email (SMTP)",
};

const ALL_PROVIDERS = Object.keys(PROVIDER_LABELS) as IntegrationProvider[];

function StatusBadge({ connection }: { connection: IntegrationConnectionSummary | undefined }) {
  if (!connection) return <Badge variant="neutral">Not configured</Badge>;
  if (!connection.isActive) return <Badge variant="warning">Inactive</Badge>;
  if (connection.lastSyncError) return <Badge variant="critical">Last sync failed</Badge>;
  return <Badge variant="good">Active</Badge>;
}

export function IntegrationsSettings() {
  const user = useAuthUser();
  const canManage = user.role === RoleName.OWNER || user.role === RoleName.ADMIN;

  const connections = useIntegrationConnections(canManage);
  const upsert = useUpsertIntegrationConnection();
  const setActive = useSetIntegrationConnectionActive();

  const [editingProvider, setEditingProvider] = useState<IntegrationProvider | null>(null);

  if (!canManage) return null;

  const byProvider = new Map((connections.data ?? []).map((c) => [c.provider, c]));

  function handleSave(provider: IntegrationProvider, credentials: Record<string, string | number | boolean>) {
    upsert.mutate({ provider, credentials }, { onSuccess: () => setEditingProvider(null) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          Per-tenant credentials for Meta Ads, Google Ads, GA4, Search Console, WooCommerce, WhatsApp, and email.
          Once saved, credentials are write-only — they're never shown again, only re-entered to change them.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ALL_PROVIDERS.map((provider) => {
          const connection = byProvider.get(provider);
          if (editingProvider === provider) {
            return (
              <IntegrationConnectionForm
                key={provider}
                provider={provider}
                onSubmit={(credentials) => handleSave(provider, credentials)}
                onCancel={() => setEditingProvider(null)}
                submitting={upsert.isPending}
              />
            );
          }
          return (
            <div key={provider} className="flex items-center justify-between gap-3 rounded-sm border border-border p-3 text-xs">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{PROVIDER_LABELS[provider]}</span>
                  <StatusBadge connection={connection} />
                </div>
                {connection?.lastSyncedAt && (
                  <span className="text-text-muted">Last synced {new Date(connection.lastSyncedAt).toLocaleString()}</span>
                )}
                {connection?.lastSyncError && <span className="text-critical">{connection.lastSyncError}</span>}
              </div>
              <div className="flex items-center gap-2">
                {connection && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={setActive.isPending}
                    onClick={() => setActive.mutate({ provider, isActive: !connection.isActive })}
                  >
                    {connection.isActive ? "Deactivate" : "Activate"}
                  </Button>
                )}
                <Button type="button" size="sm" variant="secondary" onClick={() => setEditingProvider(provider)}>
                  {connection ? "Edit" : "Configure"}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
