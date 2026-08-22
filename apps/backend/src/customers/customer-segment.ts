import { CustomerSegment } from "@hpl/shared";

const NEW_CUSTOMER_WINDOW_DAYS = 30;
const ACTIVE_WINDOW_DAYS = 90;
const AT_RISK_WINDOW_DAYS = 180;

/** No persisted status column for Customer (unlike Dealer) — segment is derived live from
 * cached lastPurchaseAt/firstPurchaseAt (see CustomerMetricsService) plus createdAt, rather
 * than cached itself, since it's cheap to compute and avoids a schema migration. */
export function deriveCustomerSegment(
  lastPurchaseAt: Date | null,
  firstPurchaseAt: Date | null,
  createdAt: Date,
  now: Date = new Date(),
): CustomerSegment {
  const daysSinceCreated = (now.getTime() - createdAt.getTime()) / 86400000;
  if (!firstPurchaseAt && daysSinceCreated <= NEW_CUSTOMER_WINDOW_DAYS) return "NEW";

  if (!lastPurchaseAt) return "DORMANT";

  const daysSinceLastPurchase = (now.getTime() - lastPurchaseAt.getTime()) / 86400000;
  if (daysSinceLastPurchase <= ACTIVE_WINDOW_DAYS) return "ACTIVE";
  if (daysSinceLastPurchase <= AT_RISK_WINDOW_DAYS) return "AT_RISK";
  return "DORMANT";
}
