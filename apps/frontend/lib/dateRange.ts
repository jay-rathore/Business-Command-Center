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
