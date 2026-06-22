/**
 * Small, dependency-free statistics helpers used by the engine.
 * Kept separate so the math is easy to read, test, and reason about.
 */

/** Bits-per-byte. The single most-botched constant in speed tests. */
const BITS_PER_BYTE = 8;

/**
 * Convert a transfer into megabits per second.
 *
 *   Mbps = (bytes * 8 bits/byte) / (seconds) / 1e6
 *
 * Note the 1e6 (decimal mega), NOT 1<<20 — network speeds are quoted in
 * decimal megabits, the same convention ISPs advertise.
 */
export function bytesToMbps(bytes: number, ms: number): number {
  if (ms <= 0) return 0;
  const seconds = ms / 1000;
  return (bytes * BITS_PER_BYTE) / seconds / 1e6;
}

/** Convert Mbps to megabytes per second for the MB/s display toggle. */
export function mbpsToMBytes(mbps: number): number {
  return mbps / BITS_PER_BYTE;
}

/** Ascending-sorted copy. */
function sortedAsc(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/** Median (50th percentile). Returns 0 for an empty array. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = sortedAsc(values);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function min(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.min(...values);
}

export function max(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

/**
 * Linear-interpolation percentile (the "R-7" method used by NumPy & Excel).
 *
 * For bandwidth we report the 90th percentile rather than the mean: a saturated
 * link spends most of its time near its true ceiling, and p90 captures that
 * ceiling while shrugging off the slow warmup samples and transient dips that
 * would drag a mean down. (We still keep the mean around for sanity-checking.)
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const s = sortedAsc(values);
  const rank = (p / 100) * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return s[lo];
  const frac = rank - lo;
  return s[lo] + (s[hi] - s[lo]) * frac;
}

/**
 * Jitter = the mean absolute difference between *consecutive* round trips.
 * This measures how much latency wobbles sample-to-sample, which is what
 * actually degrades real-time traffic — not the spread around the mean.
 */
export function jitter(rtts: number[]): number {
  if (rtts.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < rtts.length; i++) {
    sum += Math.abs(rtts[i] - rtts[i - 1]);
  }
  return sum / (rtts.length - 1);
}

/**
 * Map a bufferbloat delta (loaded median minus idle median, in ms) to a grade.
 * Thresholds follow the common convention used by latency-under-load tests.
 */
export function bufferbloatGrade(
  deltaMs: number | null,
): "A" | "B" | "C" | "D" | "F" | null {
  if (deltaMs === null) return null;
  if (deltaMs < 5) return "A";
  if (deltaMs < 30) return "B";
  if (deltaMs < 60) return "C";
  if (deltaMs < 200) return "D";
  return "F";
}
