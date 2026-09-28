import { describe, it, expect } from "vitest";
import { isMobileUserAgent } from "@/lib/is-mobile";
import { NextFetchEvent, NextRequest } from "next/server";
import { proxy } from "@/proxy";
import mobileManifest from "@/app/(mobile)/manifest";
import { fromPartial } from "@total-typescript/shoehorn";

describe("Mobile & Desktop Route Groups Architecture", () => {
  describe("User Agent Detection (isMobileUserAgent)", () => {
    it("identifies mobile user agents accurately", () => {
      const mobileUAs = [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 Chrome/112.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        "Mozilla/5.0 (Android 12; Mobile; rv:109.0) Gecko/109.0 Firefox/113.0",
      ];

      for (const ua of mobileUAs) {
        expect(isMobileUserAgent(ua)).toBe(true);
      }
    });

    it("identifies desktop user agents accurately", () => {
      const desktopUAs = [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ];

      for (const ua of desktopUAs) {
        expect(isMobileUserAgent(ua)).toBe(false);
      }
    });
  });

  describe("Proxy User-Agent Route Rewriting", () => {
    it("rewrites mobile requests to (mobile) route group", async () => {
      const req = new NextRequest("https://fderuiter.com/proof", {
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        },
      });

      const res = await proxy(req, fromPartial<NextFetchEvent>({}));
      expect(res).toBeDefined();
      const rewriteUrl = res?.headers.get("x-middleware-rewrite");
      expect(rewriteUrl).toContain("/(mobile)/proof");
    });

    it("rewrites desktop requests to (desktop) route group", async () => {
      const req = new NextRequest("https://fderuiter.com/proof", {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });

      const res = await proxy(req, fromPartial<NextFetchEvent>({}));
      expect(res).toBeDefined();
      const rewriteUrl = res?.headers.get("x-middleware-rewrite");
      expect(rewriteUrl).toContain("/(desktop)/proof");
    });

    it("rewrites root path correctly for mobile and desktop", async () => {
      const mobileReq = new NextRequest("https://fderuiter.com/", {
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        },
      });
      const mobileRes = await proxy(mobileReq, fromPartial<NextFetchEvent>({}));
      expect(mobileRes).toBeDefined();
      expect(mobileRes?.headers.get("x-middleware-rewrite")).toContain(
        "/(mobile)"
      );

      const desktopReq = new NextRequest("https://fderuiter.com/", {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
      });
      const desktopRes = await proxy(
        desktopReq,
        fromPartial<NextFetchEvent>({})
      );
      expect(desktopRes).toBeDefined();
      expect(desktopRes?.headers.get("x-middleware-rewrite")).toContain(
        "/(desktop)"
      );
    });

    it("skips route group rewrite for API routes", async () => {
      const req = new NextRequest("https://fderuiter.com/api/contact", {
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        },
      });

      const res = await proxy(req, fromPartial<NextFetchEvent>({}));
      expect(res).toBeDefined();
      expect(res?.headers.get("x-middleware-rewrite")).toBeNull();
    });
  });

  describe("Mobile Web Manifest (app/(mobile)/manifest.ts)", () => {
    it("returns touch-optimized metadata", () => {
      const manifestData = mobileManifest();
      expect(manifestData.name).toContain("Mobile");
      expect(manifestData.display).toBe("standalone");
      expect(manifestData.orientation).toBe("portrait");
      expect(manifestData.icons).toBeDefined();
      expect(manifestData.icons!.length).toBeGreaterThan(0);
    });
  });
});
