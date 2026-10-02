export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

/** Appends dateFrom/dateTo to `path` (which may already carry a query string) — omits either
 * bound that's unset, so a page with no selected range hits the endpoint's untouched default. */
export function appendDateRange(path: string, range: DateRange): string {
  const params = new URLSearchParams();
  if (range.dateFrom) params.set("dateFrom", range.dateFrom);
  if (range.dateTo) params.set("dateTo", range.dateTo);
  const qs = params.toString();
  if (!qs) return path;
  return path.includes("?") ? `${path}&${qs}` : `${path}?${qs}`;
}

// Deliberately an explicit wide range, not {} (cleared params) — every backend endpoint decides
// what "no range given" means for itself, and that's inconsistent: overview/KPI endpoints (e.g.
// SalesService.getOverview) default an absent range to the current month, while breakdown/table
// endpoints (dateRangeWhere-based) treat it as genuinely unrestricted. Sending an explicit range
// this old forces every endpoint through its normal explicit-range math instead, so "All time"
// actually means all time everywhere, consistently.
export const ALL_TIME_FROM = "2000-01-01";

// Only these pages have period-scoped data (KPIs/trends/breakdowns) — everywhere else the
// picker would be inert, so it renders as nothing rather than a dead control. Projects is
// deliberately excluded: its KPIs/Kanban/watchlist are a live pipeline snapshot with no date
// dimension, only its "All Projects" table would react, so showing the picker there would look
// broken (most of the page staying frozen while one table changes).
export const DATE_AWARE_ROUTES = ["/dashboard", "/marketing", "/sales", "/sales-team", "/leads", "/customers", "/dealers", "/products"];

export function isDateAwareRoute(pathname: string): boolean {
  return DATE_AWARE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
