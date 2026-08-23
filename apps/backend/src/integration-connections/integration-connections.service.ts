import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IntegrationConnection, IntegrationProvider } from "@prisma/client";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { PrismaService } from "../prisma/prisma.service";
import { decryptCredentials, encryptCredentials } from "../common/crypto/integration-credentials";

export interface ConnectionSummary {
  id: string;
  provider: IntegrationProvider;
  isActive: boolean;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  updatedAt: Date;
}

/** CRUD + credential access for per-tenant IntegrationConnection rows. Two Prisma clients are
 * used deliberately: the org-scoped EXTENDED client for everything that runs inside a known
 * tenant's context (the Settings UI's own org, or a sync service that has already entered
 * TenantContext.run for one connection), and the base (unscoped) client for listActive() —
 * that one has to run BEFORE any tenant is known, to discover which tenants even have this
 * provider configured, so it can't go through the org-scope extension at all. Same reasoning
 * as AuthService's login lookup using the base client. */
@Injectable()
export class IntegrationConnectionsService {
  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly rawPrisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private encryptionKey(): string {
    return this.config.getOrThrow<string>("INTEGRATION_ENCRYPTION_KEY");
  }

  /** Every connection for one tenant (never includes decrypted credentials) — for the Settings UI. */
  async listForOrg(organizationId: string): Promise<ConnectionSummary[]> {
    const rows = await this.prisma.integrationConnection.findMany({
      where: { organizationId },
      orderBy: { provider: "asc" },
    });
    return rows.map(toSummary);
  }

  /** Every ACTIVE connection for a provider, across every tenant — deliberately unscoped, see
   * class doc. Callers decrypt `credentials` themselves (via decryptCredentials) once they've
   * entered TenantContext.run for that row's organizationId. */
  async listActive(provider: IntegrationProvider): Promise<IntegrationConnection[]> {
    return this.rawPrisma.integrationConnection.findMany({ where: { provider, isActive: true } });
  }

  decrypt<T>(connection: Pick<IntegrationConnection, "credentials">): T {
    return decryptCredentials<T>(connection.credentials, this.encryptionKey());
  }

  /** The raw row (still-encrypted credentials + id) for one tenant/provider, or null if not
   * configured/inactive. Used where the caller needs the id too (to call recordSuccess/
   * recordError after a manual sync), not just the decrypted credentials. */
  async findOne(organizationId: string, provider: IntegrationProvider): Promise<IntegrationConnection | null> {
    const row = await this.prisma.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId, provider } },
    });
    return row && row.isActive ? row : null;
  }

  /** Decrypts and returns one tenant's credentials for a provider, or null if not configured/
   * inactive. Must be called from within that tenant's request/TenantContext — used by
   * WhatsApp/Email at send time, and anywhere that doesn't also need the connection id. */
  async getCredentials<T>(organizationId: string, provider: IntegrationProvider): Promise<T | null> {
    const row = await this.findOne(organizationId, provider);
    return row ? this.decrypt<T>(row) : null;
  }

  async upsert(
    organizationId: string,
    provider: IntegrationProvider,
    credentials: Record<string, unknown>,
    isActive = true,
  ): Promise<ConnectionSummary> {
    const encrypted = encryptCredentials(credentials, this.encryptionKey());
    const row = await this.prisma.integrationConnection.upsert({
      where: { organizationId_provider: { organizationId, provider } },
      update: { credentials: encrypted, isActive, lastSyncError: null },
      create: { organizationId, provider, credentials: encrypted, isActive },
    });
    return toSummary(row);
  }

  async setActive(organizationId: string, provider: IntegrationProvider, isActive: boolean): Promise<ConnectionSummary> {
    const row = await this.prisma.integrationConnection.update({
      where: { organizationId_provider: { organizationId, provider } },
      data: { isActive },
    });
    return toSummary(row);
  }

  /** id-scoped, called from inside a per-connection TenantContext.run during a cron sweep. */
  async recordSuccess(id: string): Promise<void> {
    await this.prisma.integrationConnection.update({
      where: { id },
      data: { lastSyncedAt: new Date(), lastSyncError: null },
    });
  }

  async recordError(id: string, message: string): Promise<void> {
    await this.prisma.integrationConnection.update({
      where: { id },
      data: { lastSyncError: message.slice(0, 2000) },
    });
  }
}

function toSummary(row: IntegrationConnection): ConnectionSummary {
  return {
    id: row.id,
    provider: row.provider,
    isActive: row.isActive,
    lastSyncedAt: row.lastSyncedAt,
    lastSyncError: row.lastSyncError,
    updatedAt: row.updatedAt,
  };
}
