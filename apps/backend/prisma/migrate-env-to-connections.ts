/**
 * One-time migration: HPL Maker's third-party credentials used to live in one global `.env`,
 * read directly by each sync/send service. Now that IntegrationConnection scopes credentials
 * per-tenant (see [[project_saas_multitenant_roadmap]] / src/integration-connections/), those
 * services no longer read ConfigService for them at all — this script is what makes HPL
 * Maker's own syncs keep working: it reads the current .env values one last time and writes
 * them into HPL Maker's IntegrationConnection rows.
 *
 * Providers whose required env vars aren't all set are skipped with a log line — add them
 * later via the Settings UI once real credentials exist (Google Ads/GA4/Search Console/
 * WhatsApp are all currently unconfigured, per this repo's .env, as of this migration).
 *
 * Usage: npm run db:migrate-env-to-connections   (see package.json)
 */
import { IntegrationProvider, PrismaClient } from "@prisma/client";
import { encryptCredentials } from "../src/common/crypto/integration-credentials";

const prisma = new PrismaClient();
const ORG_SLUG = "hpl-maker"; // matches seed.ts / import-crm-snapshot.ts

function env(key: string): string | undefined {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

/** Returns the built credentials object, or null (with a log line) if any required field is
 * missing from .env — never throws, so one unconfigured provider doesn't block the others.
 * Loosely typed on purpose: the real per-provider shape (credential-types.ts) is enforced by
 * whatever reads these back out via IntegrationConnectionsService.getCredentials<T>(), not here. */
function build(
  providerName: string,
  fields: Record<string, string | undefined>,
  required: string[],
): Record<string, unknown> | null {
  const missing = required.filter((key) => fields[key] === undefined);
  if (missing.length > 0) {
    console.log(`  Skipping ${providerName}: missing ${missing.join(", ")} in .env`);
    return null;
  }
  return fields;
}

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    throw new Error(`Organization "${ORG_SLUG}" not found — run "npm run db:seed" first to create it.`);
  }

  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("Missing required env var: INTEGRATION_ENCRYPTION_KEY");

  const candidates: { provider: IntegrationProvider; credentials: Record<string, unknown> | null }[] = [
    {
      provider: IntegrationProvider.META_ADS,
      credentials: build(
        "Meta Ads",
        { adAccountId: env("META_AD_ACCOUNT_ID"), accessToken: env("META_ACCESS_TOKEN") },
        ["adAccountId", "accessToken"],
      ),
    },
    {
      provider: IntegrationProvider.GOOGLE_ADS,
      credentials: build(
        "Google Ads",
        {
          clientId: env("GOOGLE_ADS_CLIENT_ID"),
          clientSecret: env("GOOGLE_ADS_CLIENT_SECRET"),
          developerToken: env("GOOGLE_ADS_DEVELOPER_TOKEN"),
          customerId: env("GOOGLE_ADS_CUSTOMER_ID"),
          loginCustomerId: env("GOOGLE_ADS_LOGIN_CUSTOMER_ID"),
          refreshToken: env("GOOGLE_ADS_REFRESH_TOKEN"),
        },
        ["clientId", "clientSecret", "developerToken", "customerId", "refreshToken"],
      ),
    },
    {
      provider: IntegrationProvider.GOOGLE_ANALYTICS,
      credentials: build(
        "Google Analytics (GA4)",
        {
          propertyId: env("GA4_PROPERTY_ID"),
          serviceAccountEmail: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
          serviceAccountPrivateKey: env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"),
        },
        ["propertyId", "serviceAccountEmail", "serviceAccountPrivateKey"],
      ),
    },
    {
      provider: IntegrationProvider.SEARCH_CONSOLE,
      credentials: build(
        "Search Console",
        {
          siteUrl: env("SEARCH_CONSOLE_SITE_URL"),
          serviceAccountEmail: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
          serviceAccountPrivateKey: env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"),
        },
        ["siteUrl", "serviceAccountEmail", "serviceAccountPrivateKey"],
      ),
    },
    {
      provider: IntegrationProvider.WOOCOMMERCE,
      credentials: build(
        "WooCommerce",
        {
          url: env("WOOCOMMERCE_URL"),
          consumerKey: env("WOOCOMMERCE_CONSUMER_KEY"),
          consumerSecret: env("WOOCOMMERCE_CONSUMER_SECRET"),
        },
        ["url", "consumerKey", "consumerSecret"],
      ),
    },
    {
      provider: IntegrationProvider.WHATSAPP,
      credentials: build(
        "WhatsApp",
        {
          phoneNumberId: env("WHATSAPP_PHONE_NUMBER_ID"),
          businessAccountId: env("WHATSAPP_BUSINESS_ACCOUNT_ID"),
          accessToken: env("WHATSAPP_ACCESS_TOKEN"),
          apiVersion: env("WHATSAPP_API_VERSION"),
        },
        ["phoneNumberId", "businessAccountId", "accessToken"],
      ),
    },
    {
      provider: IntegrationProvider.EMAIL_SMTP,
      credentials: build(
        "Email (SMTP)",
        {
          host: env("EMAIL_SMTP_HOST"),
          port: env("EMAIL_SMTP_PORT"),
          secure: env("EMAIL_SMTP_SECURE"),
          user: env("EMAIL_SMTP_USER"),
          pass: env("EMAIL_SMTP_PASS"),
          fromAddress: env("EMAIL_FROM_ADDRESS"),
          fromName: env("EMAIL_FROM_NAME"),
        },
        ["host", "port", "secure", "user", "pass", "fromAddress"],
      ),
    },
  ];

  let migrated = 0;
  for (const { provider, credentials } of candidates) {
    if (!credentials) continue;
    if (provider === IntegrationProvider.EMAIL_SMTP) {
      credentials.port = Number(credentials.port);
      credentials.secure = credentials.secure === "true" || credentials.secure === true;
    }
    await prisma.integrationConnection.upsert({
      where: { organizationId_provider: { organizationId: org.id, provider } },
      update: { credentials: encryptCredentials(credentials, encryptionKey), isActive: true },
      create: {
        organizationId: org.id,
        provider,
        credentials: encryptCredentials(credentials, encryptionKey),
        isActive: true,
      },
    });
    console.log(`  Migrated ${provider} for "${org.name}"`);
    migrated++;
  }

  console.log(`\n${migrated} connection(s) migrated for "${org.name}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
