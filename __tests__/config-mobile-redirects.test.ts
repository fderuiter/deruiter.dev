// @vitest-environment node
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

type Redirect = Awaited<
  ReturnType<NonNullable<typeof nextConfig.redirects>>
>[number];

async function getRedirects(): Promise<Redirect[]> {
  return await nextConfig.redirects!();
}

describe("canonical studio redirects (#3204)", () => {
  it("permanently redirects /m/:studio/:path* to /:studio/:path*", async () => {
    const redirects = await getRedirects();
    const legacyRedirect = redirects.find(
      (r) => r.source === "/m/:studio/:path*"
    );
    expect(legacyRedirect).toBeDefined();
    expect(legacyRedirect?.destination).toBe("/:studio/:path*");
    expect(legacyRedirect?.permanent).toBe(true);
  });

  it("has no user-agent or client-hint redirects routing away from standard studios", async () => {
    const redirects = await getRedirects();
    const uaRedirects = redirects.filter((r) =>
      r.has?.some((h) => h.key === "user-agent" || h.key === "sec-ch-ua-mobile")
    );
    expect(uaRedirects).toHaveLength(0);
  });
});
