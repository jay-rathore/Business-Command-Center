export interface SeriesPoint {
  date: Date;
  value: number;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  direction: 'up' | 'down' | null;
  baseline: number | null;
  deviationPct: number | null;
}

const ANOMALY_THRESHOLD_PCT = 25; // deviation from baseline beyond this is flagged as unusual
const SAME_WEEKDAY_LOOKBACK = 4; // how many prior same-weekday points to average
const TRAILING_FALLBACK_DAYS = 7;

/** Flags series[index] as an anomaly against a baseline built from the same-weekday average of
 * up to SAME_WEEKDAY_LOOKBACK prior occurrences (accounts for weekly traffic patterns — e.g.
 * weekends are naturally lower), falling back to a trailing-7-day average when there isn't
 * enough history yet. No equivalent baseline/anomaly utility existed anywhere in the codebase
 * before this (confirmed: business-health.service.ts only uses static absolute thresholds, not
 * baseline comparisons) — used both for auto-highlighting the Traffic Overview timeline and by
 * RootCauseEngineService to confirm a queried period was actually unusual before investigating it. */
export function detectAnomaly(
  series: SeriesPoint[],
  index: number,
): AnomalyResult {
  const point = series[index];
  if (!point)
    return {
      isAnomaly: false,
      direction: null,
      baseline: null,
      deviationPct: null,
    };

  const weekday = point.date.getUTCDay();
  const sameWeekday: number[] = [];
  for (
    let i = index - 1;
    i >= 0 && sameWeekday.length < SAME_WEEKDAY_LOOKBACK;
    i--
  ) {
    if (series[i].date.getUTCDay() === weekday)
      sameWeekday.push(series[i].value);
  }

  let baselineValues = sameWeekday;
  if (baselineValues.length < 2) {
    baselineValues = series
      .slice(Math.max(0, index - TRAILING_FALLBACK_DAYS), index)
      .map((p) => p.value);
  }
  if (baselineValues.length === 0)
    return {
      isAnomaly: false,
      direction: null,
      baseline: null,
      deviationPct: null,
    };

  const baseline =
    baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;
  if (baseline === 0)
    return {
      isAnomaly: point.value > 0,
      direction: point.value > 0 ? 'up' : null,
      baseline,
      deviationPct: null,
    };

  const deviationPct = ((point.value - baseline) / baseline) * 100;
  const isAnomaly = Math.abs(deviationPct) >= ANOMALY_THRESHOLD_PCT;

  return {
    isAnomaly,
    direction: isAnomaly ? (deviationPct > 0 ? 'up' : 'down') : null,
    baseline,
    deviationPct,
  };
}
