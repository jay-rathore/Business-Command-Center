// Hand-mirrored copy of the Prisma enums in apps/backend/prisma/schema.prisma.
// Keep in sync manually — see apps/backend/prisma/schema.prisma as the source of truth.
//
// Deliberately NOT using TypeScript's `enum` keyword: Prisma 6 generates its own enums as a
// const object + a string-literal-union type (via $Enums), not a nominal TS enum. A real
// `enum` here would be nominally incompatible with Prisma's generated types even though the
// string values match — e.g. `JwtPayload.roleName` (this package) assigned from `user.role.name`
// (Prisma) would fail to typecheck. Mirroring Prisma's own const-object-plus-type pattern keeps
// both sides structurally compatible everywhere they meet (mainly in the backend).

export const RoleName = {
  OWNER: 'OWNER',
  SALES_MANAGER: 'SALES_MANAGER',
  SALES_EXECUTIVE: 'SALES_EXECUTIVE',
  MARKETING_MANAGER: 'MARKETING_MANAGER',
  DEALER_MANAGER: 'DEALER_MANAGER',
  ADMIN: 'ADMIN',
} as const;
export type RoleName = (typeof RoleName)[keyof typeof RoleName];

export const PermissionAction = {
  READ: 'READ',
  WRITE: 'WRITE',
  DELETE: 'DELETE',
  MANAGE: 'MANAGE',
} as const;
export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction];

export const PermissionModule = {
  DASHBOARD: 'DASHBOARD',
  SALES: 'SALES',
  LEADS: 'LEADS',
  MARKETING: 'MARKETING',
  SALES_TEAM: 'SALES_TEAM',
  DEALERS: 'DEALERS',
  ARCHITECTS: 'ARCHITECTS',
  BUILDERS: 'BUILDERS',
  PROJECTS: 'PROJECTS',
  CUSTOMERS: 'CUSTOMERS',
  COMPLAINTS: 'COMPLAINTS',
  WARRANTY: 'WARRANTY',
  PRODUCTS: 'PRODUCTS',
  GEOGRAPHY: 'GEOGRAPHY',
  AI_INSIGHTS: 'AI_INSIGHTS',
  NOTIFICATIONS: 'NOTIFICATIONS',
  REPORTS: 'REPORTS',
  SETTINGS: 'SETTINGS',
} as const;
export type PermissionModule = (typeof PermissionModule)[keyof typeof PermissionModule];

export const Priority = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const ActivityType = {
  CALL: 'CALL',
  EMAIL: 'EMAIL',
  MEETING: 'MEETING',
  WHATSAPP: 'WHATSAPP',
  SITE_VISIT: 'SITE_VISIT',
  NOTE: 'NOTE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  FOLLOW_UP_SCHEDULED: 'FOLLOW_UP_SCHEDULED',
  SAMPLE_SENT: 'SAMPLE_SENT',
  QUOTE_SENT: 'QUOTE_SENT',
  ORDER_PLACED: 'ORDER_PLACED',
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

// LeadStatus/LeadSource/LeadType are no longer fixed enums — they're CRM-mirrored lookup
// tables (see apps/backend/prisma/schema.prisma) since the real HPL CRM's taxonomy (40/17/15
// live values, staff-editable) can't be represented as a closed union without losing data.
// `LeadStage` is the one small closed set left (used to classify each dynamic status row).
export const LeadStage = {
  OPEN: 'OPEN',
  WON: 'WON',
  LOST: 'LOST',
} as const;
export type LeadStage = (typeof LeadStage)[keyof typeof LeadStage];

export const DealerStatus = {
  ACTIVE: 'ACTIVE',
  AT_RISK: 'AT_RISK',
  INACTIVE: 'INACTIVE',
  NEW: 'NEW',
} as const;
export type DealerStatus = (typeof DealerStatus)[keyof typeof DealerStatus];

export const ProjectStage = {
  LEAD: 'LEAD',
  DISCOVERY: 'DISCOVERY',
  SAMPLE: 'SAMPLE',
  DESIGN_APPROVAL: 'DESIGN_APPROVAL',
  QUOTATION: 'QUOTATION',
  NEGOTIATION: 'NEGOTIATION',
  ORDER: 'ORDER',
  COMPLETED: 'COMPLETED',
  LOST: 'LOST',
} as const;
export type ProjectStage = (typeof ProjectStage)[keyof typeof ProjectStage];

export const PROJECT_STAGE_ORDER: ProjectStage[] = [
  ProjectStage.LEAD,
  ProjectStage.DISCOVERY,
  ProjectStage.SAMPLE,
  ProjectStage.DESIGN_APPROVAL,
  ProjectStage.QUOTATION,
  ProjectStage.NEGOTIATION,
  ProjectStage.ORDER,
  ProjectStage.COMPLETED,
];

export const ProjectCategory = {
  COMMERCIAL: 'COMMERCIAL',
  RESIDENTIAL: 'RESIDENTIAL',
  INDUSTRIAL: 'INDUSTRIAL',
  INSTITUTIONAL: 'INSTITUTIONAL',
  HOSPITALITY: 'HOSPITALITY',
  RETAIL: 'RETAIL',
  DEALER_FACILITY: 'DEALER_FACILITY',
} as const;
export type ProjectCategory = (typeof ProjectCategory)[keyof typeof ProjectCategory];

export const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const CampaignPlatform = {
  GOOGLE_ADS: 'GOOGLE_ADS',
  META_ADS: 'META_ADS',
  WEBSITE: 'WEBSITE',
  WHATSAPP: 'WHATSAPP',
  ORGANIC: 'ORGANIC',
  OTHER: 'OTHER',
} as const;
export type CampaignPlatform = (typeof CampaignPlatform)[keyof typeof CampaignPlatform];

export const CampaignStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const TouchType = {
  FIRST_TOUCH: 'FIRST_TOUCH',
  LAST_TOUCH: 'LAST_TOUCH',
} as const;
export type TouchType = (typeof TouchType)[keyof typeof TouchType];

export const ComplaintStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;
export type ComplaintStatus = (typeof ComplaintStatus)[keyof typeof ComplaintStatus];

export const WarrantyClaimStatus = {
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  INSPECTION: 'INSPECTION',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RESOLVED: 'RESOLVED',
} as const;
export type WarrantyClaimStatus = (typeof WarrantyClaimStatus)[keyof typeof WarrantyClaimStatus];

export const NotificationType = {
  NEW_LEAD: 'NEW_LEAD',
  MISSED_FOLLOW_UP: 'MISSED_FOLLOW_UP',
  HIGH_VALUE_LEAD: 'HIGH_VALUE_LEAD',
  HIGH_VALUE_PROJECT: 'HIGH_VALUE_PROJECT',
  INACTIVE_DEALER: 'INACTIVE_DEALER',
  DEALER_RISK: 'DEALER_RISK',
  SALES_TARGET_RISK: 'SALES_TARGET_RISK',
  MARKETING_BUDGET_WARNING: 'MARKETING_BUDGET_WARNING',
  CAMPAIGN_PERFORMANCE_WARNING: 'CAMPAIGN_PERFORMANCE_WARNING',
  COMPLAINT: 'COMPLAINT',
  WARRANTY_CLAIM: 'WARRANTY_CLAIM',
  PROJECT_INACTIVITY: 'PROJECT_INACTIVITY',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const InsightCategory = {
  SALES: 'SALES',
  MARKETING: 'MARKETING',
  LEADS: 'LEADS',
  DEALERS: 'DEALERS',
  PROJECTS: 'PROJECTS',
  CUSTOMERS: 'CUSTOMERS',
  PRODUCTS: 'PRODUCTS',
} as const;
export type InsightCategory = (typeof InsightCategory)[keyof typeof InsightCategory];

export const InsightType = {
  RISK: 'RISK',
  OPPORTUNITY: 'OPPORTUNITY',
} as const;
export type InsightType = (typeof InsightType)[keyof typeof InsightType];

export const InsightStatus = {
  NEW: 'NEW',
  REVIEWED: 'REVIEWED',
  DISMISSED: 'DISMISSED',
  ACTIONED: 'ACTIONED',
} as const;
export type InsightStatus = (typeof InsightStatus)[keyof typeof InsightStatus];

export const CustomerType = {
  INDIVIDUAL: 'INDIVIDUAL',
  BUSINESS: 'BUSINESS',
  DEALER_SELF: 'DEALER_SELF',
} as const;
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const EmployeeStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const SalesTargetScope = {
  COMPANY: 'COMPANY',
  SALES_EXECUTIVE: 'SALES_EXECUTIVE',
  DEALER: 'DEALER',
  PRODUCT_CATEGORY: 'PRODUCT_CATEGORY',
} as const;
export type SalesTargetScope = (typeof SalesTargetScope)[keyof typeof SalesTargetScope];

export const TargetPeriodType = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
} as const;
export type TargetPeriodType = (typeof TargetPeriodType)[keyof typeof TargetPeriodType];

export const QuotationStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  SEND_FAILED: 'SEND_FAILED',
} as const;
export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];

export const QuotationInputMode = {
  MANUAL: 'MANUAL',
  CHAT_AI: 'CHAT_AI',
  VOICE_AI: 'VOICE_AI',
} as const;
export type QuotationInputMode = (typeof QuotationInputMode)[keyof typeof QuotationInputMode];

export const QuotationEmailStatus = {
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;
export type QuotationEmailStatus = (typeof QuotationEmailStatus)[keyof typeof QuotationEmailStatus];

export const IntegrationProvider = {
  META_ADS: 'META_ADS',
  GOOGLE_ADS: 'GOOGLE_ADS',
  GOOGLE_ANALYTICS: 'GOOGLE_ANALYTICS',
  SEARCH_CONSOLE: 'SEARCH_CONSOLE',
  WOOCOMMERCE: 'WOOCOMMERCE',
  WHATSAPP: 'WHATSAPP',
  EMAIL_SMTP: 'EMAIL_SMTP',
} as const;
export type IntegrationProvider = (typeof IntegrationProvider)[keyof typeof IntegrationProvider];

// Sidebar nav — all 18 modules, in the spec's order. `phase` marks when each becomes functional.
export interface NavModule {
  key: string;
  label: string;
  route: string;
  phase: 1 | 2 | 3 | 4;
}

export const NAV_MODULES: NavModule[] = [
  { key: 'dashboard', label: 'Command Center', route: '/dashboard', phase: 1 },
  { key: 'sales', label: 'Sales', route: '/sales', phase: 1 },
  { key: 'leads', label: 'Leads', route: '/leads', phase: 1 },
  { key: 'scan-card', label: 'Scan Business Card', route: '/scan-card', phase: 1 },
  { key: 'quotations', label: 'Quotations', route: '/quotations', phase: 1 },
  { key: 'marketing', label: 'Marketing', route: '/marketing', phase: 1 },
  { key: 'sales-team', label: 'Sales Team', route: '/sales-team', phase: 2 },
  { key: 'dealers', label: 'Dealers', route: '/dealers', phase: 1 },
  { key: 'architects', label: 'Architects', route: '/architects', phase: 2 },
  { key: 'builders', label: 'Builders', route: '/builders', phase: 2 },
  { key: 'projects', label: 'Projects', route: '/projects', phase: 1 },
  { key: 'customers', label: 'Customers', route: '/customers', phase: 1 },
  { key: 'complaints', label: 'Complaints', route: '/complaints', phase: 3 },
  { key: 'warranty', label: 'Warranty', route: '/warranty', phase: 3 },
  { key: 'products', label: 'Products', route: '/products', phase: 1 },
  { key: 'geography', label: 'Geography', route: '/geography', phase: 3 },
  { key: 'ai-insights', label: 'AI Insights', route: '/ai-insights', phase: 4 },
  { key: 'notifications', label: 'Notifications', route: '/notifications', phase: 2 },
  { key: 'reports', label: 'Reports', route: '/reports', phase: 3 },
  { key: 'settings', label: 'Settings', route: '/settings', phase: 3 },
];
