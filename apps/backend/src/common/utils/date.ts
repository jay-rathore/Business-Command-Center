export function daysAgo(days: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfMonthsAgo(monthsAgo: number, from: Date = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() - monthsAgo, 1);
}
