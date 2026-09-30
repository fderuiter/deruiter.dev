import { describe, expect, it } from "vitest";
import {
  NUMBER_FALLBACK,
  formatBytes,
  formatNumber,
  formatPercent,
} from "@/lib/utils";
import { formatBytes as formatNeuroBytes } from "@/lib/neuro/types";

describe("formatNumber", () => {
  it("matches toFixed for fixed-decimal shorthand on ordinary values", () => {
    const samples = [0, 1, 2.5, 3.14159, 12.3456, 99.95, 1234.5678, -7.25];
    for (const value of samples) {
      for (const decimals of [0, 1, 2, 3]) {
        const expected = value.toFixed(decimals);
        // Exact binary ties are where toFixed and Intl legitimately differ.
        if (Math.abs(value * 10 ** decimals) % 1 === 0.5) continue;
        expect(formatNumber(value, decimals)).toBe(expected);
      }
    }
  });

  it("rounds on the decimal representation rather than the binary value", () => {
    expect((1.005).toFixed(2)).toBe("1.00");
    expect(formatNumber(1.005, 2)).toBe("1.01");
    expect(formatNumber(2.345, 2)).toBe("2.35");
  });

  it("does not group digits in the fixed-decimal shorthand", () => {
    expect(formatNumber(12345.678, 1)).toBe("12345.7");
  });

  it("groups digits with Intl defaults when given options", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(-9876)).toBe("-9,876");
  });

  it("renders negative values that round to zero without a minus sign", () => {
    expect(formatNumber(-0.001, 2)).toBe("0.00");
    expect(formatNumber(-0, 1)).toBe("0.0");
    expect(formatNumber(-0.0004)).toBe("0");
    expect(formatNumber(-0.5, 0)).toBe("-1");
  });

  it("falls back to an em dash for non-finite and missing input", () => {
    expect(formatNumber(NaN, 2)).toBe(NUMBER_FALLBACK);
    expect(formatNumber(Infinity)).toBe(NUMBER_FALLBACK);
    expect(formatNumber(-Infinity, 1)).toBe(NUMBER_FALLBACK);
    expect(formatNumber(null)).toBe(NUMBER_FALLBACK);
    expect(formatNumber(undefined, 2)).toBe(NUMBER_FALLBACK);
    expect(NUMBER_FALLBACK).toBe("—");
  });

  it("clamps invalid decimal counts instead of throwing", () => {
    expect(formatNumber(3.7, -2)).toBe("4");
    expect(formatNumber(3.7, NaN)).toBe("4");
    expect(() => formatNumber(1, 100)).not.toThrow();
  });

  it("pins en-US by default and honours an explicit locale", () => {
    expect(formatNumber(1234.5, { maximumFractionDigits: 1 })).toBe("1,234.5");
    expect(formatNumber(1234.5, { maximumFractionDigits: 1 }, "de-DE")).toBe(
      "1.234,5"
    );
    expect(formatNumber(0.5, 2, "fr-FR")).toBe("0,50");
  });
});

describe("formatPercent", () => {
  it("formats fractional ratios", () => {
    expect(formatPercent(0.95)).toBe("95%");
    expect(formatPercent(0.853, { decimals: 1 })).toBe("85.3%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(1.5)).toBe("150%");
  });

  it("matches the legacy (ratio * 100).toFixed(n)% output", () => {
    for (const ratio of [0.94, 0.95, 0.96, 0.98, 0.812, 0.876, 0.999]) {
      expect(formatPercent(ratio)).toBe(`${(ratio * 100).toFixed(0)}%`);
      expect(formatPercent(ratio, { decimals: 1 })).toBe(
        `${(ratio * 100).toFixed(1)}%`
      );
    }
  });

  it("formats whole-scale percentages", () => {
    expect(formatPercent(42, { scale: "whole" })).toBe("42%");
    expect(formatPercent(98.4, { scale: "whole" })).toBe("98%");
    expect(formatPercent(30.2, { scale: "whole", decimals: 1 })).toBe("30.2%");
  });

  it("handles negatives, rounding to zero and non-finite input", () => {
    expect(formatPercent(-0.25)).toBe("-25%");
    expect(formatPercent(-0.001)).toBe("0%");
    expect(formatPercent(NaN)).toBe(NUMBER_FALLBACK);
    expect(formatPercent(Infinity, { scale: "whole" })).toBe(NUMBER_FALLBACK);
  });

  it("does not group digits and honours an explicit locale", () => {
    expect(formatPercent(12.345)).toBe("1235%");
    expect(formatPercent(0.5, { locale: "de-DE" })).toMatch(/^50\s%$/);
  });
});

describe("formatBytes", () => {
  it("picks the largest binary unit that fits and trims zeros", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(3.25 * 1024 ** 3, { decimals: 2 })).toBe("3.25 GB");
    expect(formatBytes(2 * 1024 ** 4)).toBe("2 TB");
  });

  it("caps the unit at TB rather than printing an undefined suffix", () => {
    expect(formatBytes(2048 * 1024 ** 4)).toBe("2048 TB");
  });

  it("uses B for fractional byte counts", () => {
    expect(formatBytes(0.5)).toBe("0.5 B");
  });

  it("returns 0 B for zero, negative and non-finite input", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-10)).toBe("0 B");
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(Infinity)).toBe("0 B");
    expect(formatBytes(null)).toBe("0 B");
    expect(formatBytes(undefined)).toBe("0 B");
  });

  it("pins a unit with fixed decimals like the legacy uploader label", () => {
    const sizes = [1, 500 * 1024, 1024 * 1024, 2.5 * 1024 * 1024, 4999999];
    for (const size of sizes) {
      expect(
        formatBytes(size, { unit: "MB", decimals: 2, trimZeros: false })
      ).toBe(`${(size / (1024 * 1024)).toFixed(2)} MB`);
    }
    expect(formatBytes(0, { unit: "MB", decimals: 2, trimZeros: false })).toBe(
      "0.00 MB"
    );
  });

  it("stays behaviourally identical through the neuro re-export", () => {
    const legacy = (bytes: number, decimals = 1) => {
      if (!bytes || bytes <= 0) return "0 B";
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(decimals))} ${sizes[i]}`;
    };
    const samples = [
      0, 1, 512, 1023, 1024, 1500, 1048575, 1048576, 12582912, 5e9,
    ];
    for (const bytes of samples) {
      expect(formatNeuroBytes(bytes)).toBe(legacy(bytes));
      expect(formatNeuroBytes(bytes, 2)).toBe(legacy(bytes, 2));
    }
  });
});
