// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  escapeXml,
  getClientIp,
  getAnonymousDeviceHash,
  generateId,
  generateRandomId,
  isValidIsoDate,
  formatIsoDate,
  formatDisplayDate,
  formatRelativeTime,
} from "../lib/utils";

describe("Unified Shared Utility Suite (lib/utils.ts)", () => {
  describe("1. Parameterized Text Escaping (escapeXml)", () => {
    it("escapes standard XML entities with default single quote &apos;", () => {
      const input = "AT&T <500> \"quote\" 'single'";
      const output = escapeXml(input);
      expect(output).toBe(
        "AT&amp;T &lt;500&gt; &quot;quote&quot; &apos;single&apos;"
      );
    });

    it("supports parameterized single quote entity &#39; via options object", () => {
      const input = "Term with 'single quotes' & 'ampersands'";
      const output = escapeXml(input, { singleQuoteEntity: "&#39;" });
      expect(output).toBe(
        "Term with &#39;single quotes&#39; &amp; &#39;ampersands&#39;"
      );
    });

    it("supports parameterized single quote entity &#39; via boolean true parameter", () => {
      const input = "User's test";
      const output = escapeXml(input, true);
      expect(output).toBe("User&#39;s test");
    });

    it("handles null, undefined, and empty string safely", () => {
      expect(escapeXml(null)).toBe("");
      expect(escapeXml(undefined)).toBe("");
      expect(escapeXml("")).toBe("");
    });
  });

  describe("2. Client Identification & Anonymous Device Hashing", () => {
    it("extracts trimmed IP from x-forwarded-for header chain", () => {
      const headers = new Headers({
        "x-forwarded-for": "  203.0.113.195 , 198.51.100.17  ",
      });
      const ip = getClientIp(headers);
      expect(ip).toBe("203.0.113.195");
    });

    it("falls back to x-real-ip when x-forwarded-for is missing", () => {
      const headers = new Headers({
        "x-real-ip": " 198.51.100.42 ",
      });
      const ip = getClientIp(headers);
      expect(ip).toBe("198.51.100.42");
    });

    it("defaults to 127.0.0.1 when no proxy headers are present", () => {
      expect(getClientIp(null)).toBe("127.0.0.1");
      expect(getClientIp(new Headers())).toBe("127.0.0.1");
    });

    it("computes identical anonymous device hashes for identical requests across formats", () => {
      const headersInit = {
        "x-forwarded-for": "192.0.2.1",
        "user-agent": "Mozilla/5.0 (X11; Linux x86_64)",
      };

      const req1 = new NextRequest("http://localhost/api/telemetry", {
        headers: headersInit,
      });
      const req2 = new NextRequest(
        "http://localhost/api/case-studies/feedback",
        { headers: headersInit }
      );
      const plainHeaders = new Headers(headersInit);

      const hash1 = getAnonymousDeviceHash(req1);
      const hash2 = getAnonymousDeviceHash(req2);
      const hash3 = getAnonymousDeviceHash(plainHeaders);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1).toHaveLength(64); // SHA-256 hex string
    });

    it("differs when user-agent or IP changes", () => {
      const reqA = new NextRequest("http://localhost/api/telemetry", {
        headers: { "x-forwarded-for": "192.0.2.1", "user-agent": "AgentA" },
      });
      const reqB = new NextRequest("http://localhost/api/telemetry", {
        headers: { "x-forwarded-for": "192.0.2.2", "user-agent": "AgentA" },
      });
      const reqC = new NextRequest("http://localhost/api/telemetry", {
        headers: { "x-forwarded-for": "192.0.2.1", "user-agent": "AgentB" },
      });

      expect(getAnonymousDeviceHash(reqA)).not.toBe(
        getAnonymousDeviceHash(reqB)
      );
      expect(getAnonymousDeviceHash(reqA)).not.toBe(
        getAnonymousDeviceHash(reqC)
      );
    });
  });

  describe("3. Unified Random Identifier Generator (generateId / generateRandomId)", () => {
    it("generates random string identifiers without prefix", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(typeof id1).toBe("string");
      expect(id1.length).toBeGreaterThan(0);
      expect(id1).not.toBe(id2);
    });

    it("formats random identifiers with custom prefix", () => {
      const widgetId = generateId("widget");
      const fieldId = generateId("f_text_");
      const queryId = generateId("qry-");

      expect(widgetId).toMatch(/^widget-[a-z0-9]+$/i);
      expect(fieldId).toMatch(/^f_text_[a-z0-9]+$/i);
      expect(queryId).toMatch(/^qry-[a-z0-9]+$/i);
    });

    it("provides generateRandomId alias", () => {
      const id = generateRandomId("test");
      expect(id).toMatch(/^test-[a-z0-9]+$/i);
    });

    it("produces a fixed-length random part", () => {
      for (let i = 0; i < 200; i++) {
        expect(generateId()).toMatch(/^[a-z0-9]{9}$/);
      }
    });

    it("inserts a creation timestamp when requested, reusing the prefix delimiter", () => {
      vi.spyOn(Date, "now").mockReturnValue(1759140000000);
      try {
        expect(generateId("event", { timestamp: true })).toMatch(
          /^event-1759140000000-[a-z0-9]{9}$/
        );
        expect(generateId("offline_", { timestamp: true })).toMatch(
          /^offline_1759140000000_[a-z0-9]{9}$/
        );
        expect(generateId("log-", { timestamp: true })).toMatch(
          /^log-1759140000000-[a-z0-9]{9}$/
        );
        expect(generateId(undefined, { timestamp: true })).toMatch(
          /^1759140000000-[a-z0-9]{9}$/
        );
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("does not collide across 10,000 generations", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10_000; i++) ids.add(generateId("c"));
      expect(ids.size).toBe(10_000);
    });

    it("prefers Web Crypto over Math.random", () => {
      const mathSpy = vi.spyOn(Math, "random");
      try {
        generateId("x");
        expect(mathSpy).not.toHaveBeenCalled();
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("falls back to getRandomValues when randomUUID is unavailable", () => {
      vi.stubGlobal("crypto", {
        getRandomValues: (arr: Uint8Array) => arr.fill(0xab),
      });
      try {
        expect(generateId("fb")).toBe("fb-ababababa");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("falls back to a padded Math.random part without Web Crypto (SSR-safe)", () => {
      vi.stubGlobal("crypto", undefined);
      const mathSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
      try {
        const id = generateId("ssr");
        expect(mathSpy).toHaveBeenCalled();
        expect(id).toMatch(/^ssr-[a-z0-9]{9}$/);
      } finally {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
      }
    });
  });

  describe("4. Standardized Date Formatting Utilities", () => {
    it("validates clinical ISO-8601 date strings", () => {
      expect(isValidIsoDate("2026-08-18")).toBe(true);
      expect(isValidIsoDate("2026-08-18T12:00:00.000Z")).toBe(true);
      expect(isValidIsoDate("2026-08-18T12:00:00Z")).toBe(true);
      expect(isValidIsoDate("2026-08-18T12:00:00+00:00")).toBe(true);

      expect(isValidIsoDate("invalid-date")).toBe(false);
      expect(isValidIsoDate("08/18/2026")).toBe(false);
      expect(isValidIsoDate("")).toBe(false);
      expect(isValidIsoDate(null)).toBe(false);
    });

    it("formats dates to clinical ISO-8601 UTC strings", () => {
      const now = new Date("2026-08-18T12:00:00.000Z");
      expect(formatIsoDate(now)).toBe("2026-08-18T12:00:00.000Z");
      expect(formatIsoDate("2026-08-18T12:00:00.000Z")).toBe(
        "2026-08-18T12:00:00.000Z"
      );
      expect(formatIsoDate(now.getTime())).toBe("2026-08-18T12:00:00.000Z");
      expect(formatIsoDate(null)).toBe("");
      expect(formatIsoDate("invalid")).toBe("");
    });

    it("formats user presentation timestamps", () => {
      const date = new Date("2026-08-18T12:00:00.000Z");
      const formatted = formatDisplayDate(date);
      expect(formatted).toContain("2026");
      expect(formatted).toContain("Aug");
      expect(formatDisplayDate(null)).toBe("");
    });

    it("formats relative timestamps", () => {
      const now = Date.now();
      expect(formatRelativeTime(new Date(now - 10 * 1000))).toBe("Just now");
      expect(formatRelativeTime(new Date(now - 45 * 1000))).toBe("45s ago");
      expect(formatRelativeTime(new Date(now - 15 * 60 * 1000))).toBe(
        "15m ago"
      );
      expect(formatRelativeTime(new Date(now - 3 * 3600 * 1000))).toBe(
        "3h ago"
      );
      expect(formatRelativeTime(new Date(now - 5 * 86400 * 1000))).toBe(
        "5d ago"
      );
      expect(formatRelativeTime(null)).toBe("");
    });
  });
});
