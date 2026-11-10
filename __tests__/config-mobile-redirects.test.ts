// @vitest-environment node
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

/**
 * The phone redirects for the desktop studios moved from `proxy.ts` into
 * `redirects()` in `next.config.ts` (#3204), so they answer without invoking
 * the proxy, and the proxy dropped its copy of the rule (#3205). These checks
 * hold the config to that rule: the same user agents go to `/m/<studio>`,
 * and the rest stay put.
 */

const USER_AGENTS = {
  "Pixel 7":
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  "iPhone 15":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "iPad mini":
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Opera Mini":
    "Opera/9.80 (J2ME/MIDP; Opera Mini/9.80/37.9178; U; en) Presto/2.12.423 Version/12.16",
  BlackBerry:
    "Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en) AppleWebKit/534.11+ (KHTML, like Gecko) Version/7.1.0.346 Mobile Safari/534.11+",
  "Desktop Chrome":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Desktop Safari":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  Empty: "",
} as const;

type Redirect = Awaited<
  ReturnType<NonNullable<typeof nextConfig.redirects>>
>[number];

async function studioRedirects(): Promise<Redirect[]> {
  const redirects = await nextConfig.redirects!();
  return redirects.filter((redirect) => redirect.destination.startsWith("/m/"));
}

/** Next matches a `has` value as a regex anchored at both ends. */
function configRedirects(
  redirects: readonly Redirect[],
  headers: Record<string, string>
): boolean {
  return redirects.some((redirect) =>
    (redirect.has ?? []).every(
      (condition) =>
        condition.type === "header" &&
        condition.value !== undefined &&
        new RegExp(`^${condition.value}$`).test(
          headers[condition.key.toLowerCase()] ?? ""
        )
    )
  );
}

/** The rule `proxy.ts` applied before #3204, kept as the reference. */
function proxyRedirects(headers: Record<string, string>): boolean {
  return (
    /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(
      headers["user-agent"] ?? ""
    ) || headers["sec-ch-ua-mobile"] === "?1"
  );
}

describe("phone redirects from the desktop studios (#3204)", () => {
  it("covers /crf, /proof, /neuro and /patrol and their subpaths, temporarily", async () => {
    const redirects = await studioRedirects();
    expect(redirects).toHaveLength(2);
    for (const redirect of redirects) {
      expect(redirect.source).toBe("/:studio(crf|proof|neuro|patrol)/:path*");
      expect(redirect.destination).toBe("/m/:studio/:path*");
      expect(redirect.permanent).toBe(false);
    }
  });

  it.each(Object.entries(USER_AGENTS))(
    "agrees with the former proxy rule for %s",
    async (_name, userAgent) => {
      const headers = { "user-agent": userAgent };
      expect(configRedirects(await studioRedirects(), headers)).toBe(
        proxyRedirects(headers)
      );
    }
  );

  it("agrees with the former proxy rule on the sec-ch-ua-mobile client hint", async () => {
    const redirects = await studioRedirects();
    for (const hint of ["?1", "?0"]) {
      const headers = {
        "user-agent": USER_AGENTS["Desktop Chrome"],
        "sec-ch-ua-mobile": hint,
      };
      expect(configRedirects(redirects, headers)).toBe(proxyRedirects(headers));
    }
    expect(
      configRedirects(redirects, {
        "user-agent": USER_AGENTS["Desktop Chrome"],
        "sec-ch-ua-mobile": "?1",
      })
    ).toBe(true);
  });

  it("sends the phone agents and keeps the desktop ones", async () => {
    const redirects = await studioRedirects();
    const sent = Object.entries(USER_AGENTS)
      .filter(([, ua]) => configRedirects(redirects, { "user-agent": ua }))
      .map(([name]) => name);
    expect(sent).toEqual([
      "Pixel 7",
      "iPhone 15",
      "iPad mini",
      "Opera Mini",
      "BlackBerry",
    ]);
  });
});
