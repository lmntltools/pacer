import { describe, expect, it } from "vitest";
import {
  bufferbloatGrade,
  bytesToMbps,
  jitter,
  max,
  mbpsToMBytes,
  mean,
  median,
  min,
  percentile,
} from "./stats";

// These tests pin the arithmetic that decides every headline number. Bits-vs-bytes
// and percentile method are the two things speed tests get wrong most often, so
// they're asserted against hand-computed values here.

describe("bytesToMbps", () => {
  it("uses 8 bits/byte and decimal mega (1e6)", () => {
    // 1,000,000 bytes in 1 s = 8,000,000 bits/s = 8 Mbps
    expect(bytesToMbps(1_000_000, 1000)).toBeCloseTo(8, 9);
    // 125,000 bytes in 1 s = 1 Mbps (the classic sanity value)
    expect(bytesToMbps(125_000, 1000)).toBeCloseTo(1, 9);
  });

  it("scales with time", () => {
    // Same bytes over half the time = double the rate
    expect(bytesToMbps(1_000_000, 500)).toBeCloseTo(16, 9);
  });

  it("matches the real-world example (60.7 MB/s ≈ 485.6 Mbps)", () => {
    const bytesInOneSecond = 60.7 * 1e6; // 60.7 MB
    expect(bytesToMbps(bytesInOneSecond, 1000)).toBeCloseTo(485.6, 6);
  });

  it("guards against non-positive durations", () => {
    expect(bytesToMbps(1_000_000, 0)).toBe(0);
    expect(bytesToMbps(1_000_000, -5)).toBe(0);
  });
});

describe("mbpsToMBytes", () => {
  it("divides megabits by 8", () => {
    expect(mbpsToMBytes(8)).toBeCloseTo(1, 9);
    expect(mbpsToMBytes(485.6)).toBeCloseTo(60.7, 9);
  });

  it("round-trips with bytesToMbps", () => {
    for (const m of [1, 25, 100, 511.5, 940]) {
      const mbytesPerSec = mbpsToMBytes(m); // MB/s
      const bytesInOneSecond = mbytesPerSec * 1e6;
      expect(bytesToMbps(bytesInOneSecond, 1000)).toBeCloseTo(m, 6);
    }
  });
});

describe("percentile (R-7 linear interpolation)", () => {
  it("interpolates like NumPy/Excel", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    // rank = 0.90*(10-1) = 8.1 -> between s[8]=9 and s[9]=10 -> 9.1
    expect(percentile(xs, 90)).toBeCloseTo(9.1, 9);
    // rank = 0.50*9 = 4.5 -> between s[4]=5 and s[5]=6 -> 5.5
    expect(percentile(xs, 50)).toBeCloseTo(5.5, 9);
    expect(percentile(xs, 0)).toBe(1);
    expect(percentile(xs, 100)).toBe(10);
  });

  it("is order-independent", () => {
    expect(percentile([10, 1, 5, 3, 8], 50)).toBeCloseTo(percentile([1, 3, 5, 8, 10], 50), 9);
  });

  it("handles empty and single-element inputs", () => {
    expect(percentile([], 90)).toBe(0);
    expect(percentile([42], 90)).toBe(42);
  });
});

describe("median / mean / min / max", () => {
  it("median averages the middle pair for even lengths", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBe(0);
  });
  it("mean/min/max compute the obvious values", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(min([5, 2, 9])).toBe(2);
    expect(max([5, 2, 9])).toBe(9);
    expect(mean([])).toBe(0);
    expect(min([])).toBe(0);
    expect(max([])).toBe(0);
  });
});

describe("jitter (mean |consecutive Δ|)", () => {
  it("averages absolute deltas between consecutive samples", () => {
    // |12-10| + |11-12| + |15-11| = 2 + 1 + 4 = 7, over 3 gaps = 2.333…
    expect(jitter([10, 12, 11, 15])).toBeCloseTo(7 / 3, 9);
  });
  it("is zero when there is nothing to compare", () => {
    expect(jitter([])).toBe(0);
    expect(jitter([42])).toBe(0);
    expect(jitter([5, 5, 5])).toBe(0);
  });
});

describe("bufferbloatGrade", () => {
  it("maps the delta thresholds A–F", () => {
    expect(bufferbloatGrade(0)).toBe("A");
    expect(bufferbloatGrade(4.9)).toBe("A");
    expect(bufferbloatGrade(5)).toBe("B");
    expect(bufferbloatGrade(29.9)).toBe("B");
    expect(bufferbloatGrade(30)).toBe("C");
    expect(bufferbloatGrade(59.9)).toBe("C");
    expect(bufferbloatGrade(60)).toBe("D");
    expect(bufferbloatGrade(199)).toBe("D");
    expect(bufferbloatGrade(200)).toBe("F");
  });
  it("returns null when there is no measurement", () => {
    expect(bufferbloatGrade(null)).toBeNull();
  });
});
