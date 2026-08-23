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

export function daysInPeriod(period: DatePeriod): number {
  return (
    Math.round(
      (period.to.getTime() - period.from.getTime()) / (24 * 60 * 60 * 1000),
    ) + 1
  );
}

/** The immediately preceding period of equal length — e.g. for a 7-day period, the 7 days right
 * before it. Used throughout Traffic Intelligence as the "compared with" baseline for
 * day-over-day / week-over-week / period-over-period deltas — no equivalent helper existed
 * before this (common/utils/date.ts only has daysAgo/startOfMonth). */
export function getPreviousEquivalentPeriod(period: DatePeriod): DatePeriod {
  const lengthDays = daysInPeriod(period);
  const to = new Date(period.from.getTime() - 24 * 60 * 60 * 1000);
  const from = new Date(to.getTime() - (lengthDays - 1) * 24 * 60 * 60 * 1000);
  return { from, to };
}

export function isWithinPeriod(date: Date, period: DatePeriod): boolean {
  return (
    date.getTime() >= period.from.getTime() &&
    date.getTime() <= period.to.getTime()
  );
}

export function percentChange(before: number, after: number): number | null {
  if (before === 0) return after === 0 ? 0 : null; // undefined percentage change from a zero baseline
  return ((after - before) / before) * 100;
}
