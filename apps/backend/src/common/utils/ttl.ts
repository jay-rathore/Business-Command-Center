const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** Parses "15m" / "30d" style env TTLs into seconds — sidesteps fighting the `ms` package's
 * template-literal StringValue type for a value that only ever comes from our own .env. */
export function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    throw new Error(`Invalid TTL format: "${ttl}" (expected e.g. "15m", "30d")`);
  }
  return Number(match[1]) * UNIT_SECONDS[match[2]];
}
