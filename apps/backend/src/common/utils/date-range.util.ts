export interface DatePeriod {
  from: Date;
  to: Date;
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** The immediately preceding period of equal length — e.g. for a 7-day period, the 7 days right
 * before it. Used as the "compared with" baseline when a caller-supplied range replaces the
 * default calendar-month comparison. */
export function getPreviousEquivalentPeriod(period: DatePeriod): DatePeriod {
  const lengthDays = Math.round((period.to.getTime() - period.from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const to = new Date(period.from.getTime() - 24 * 60 * 60 * 1000);
  const from = new Date(to.getTime() - (lengthDays - 1) * 24 * 60 * 60 * 1000);
  return { from, to };
}

/** Builds a Prisma-ready date-range filter for `field`, or `{}` when both bounds are absent —
 * spread this into an existing `where` so omitting dateFrom/dateTo leaves the query unchanged.
 * Untyped return (used across several unrelated Prisma model `where` shapes) — callers spread
 * it into a properly-typed `where` object, so the field/value shape is still checked there. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dateRangeWhere(field: string, dateFrom?: string, dateTo?: string): any {
  if (!dateFrom && !dateTo) return {};
  return {
    [field]: {
      ...(dateFrom ? { gte: parseDateOnly(dateFrom) } : {}),
      ...(dateTo ? { lte: endOfDay(parseDateOnly(dateTo)) } : {}),
    },
  };
}
