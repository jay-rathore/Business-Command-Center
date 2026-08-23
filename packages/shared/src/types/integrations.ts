import { IntegrationProvider } from "../enums";

// Never carries decrypted credentials — the backend encrypts on write and never returns them.
export interface IntegrationConnectionSummary {
  id: string;
  provider: IntegrationProvider;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  updatedAt: string;
}

export interface UpsertIntegrationConnectionRequest {
  provider: IntegrationProvider;
  credentials: Record<string, string | number | boolean>;
  isActive?: boolean;
}
