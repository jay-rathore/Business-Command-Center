/** Per-provider credential shapes stored (encrypted) in IntegrationConnection.credentials.
 * Field names match exactly what each sync/send service used to read from ConfigService, so
 * the migration off global env vars (prisma/migrate-env-to-connections.ts) is a 1:1 mapping. */

export interface MetaAdsCredentials {
  adAccountId: string;
  accessToken: string;
}

export interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
  refreshToken: string;
}

export interface GoogleAnalyticsCredentials {
  propertyId: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
}

export interface SearchConsoleCredentials {
  siteUrl: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
}

export interface WooCommerceCredentials {
  url: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface WhatsAppCredentials {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  apiVersion?: string;
}

export interface EmailSmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromAddress: string;
  fromName?: string;
}
