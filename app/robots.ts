import type { MetadataRoute } from "next";
import { isProductionEnvironment } from "@/lib/env";
import { resolveBaseUrl } from "@/lib/domain";

/** AI answer-engine crawlers that are explicitly welcome on the static manifests (ADR 0053). */
export const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
];

const DISALLOWED_PATHS = ["/api/", "/_next/", "/admin", "/admin/"];

export default function robots(): MetadataRoute.Robots {
  const isProd = isProductionEnvironment();

  if (isProd) {
    return {
      rules: [
        {
          userAgent: "*",
          allow: "/",
          disallow: DISALLOWED_PATHS,
        },
        {
          userAgent: AI_CRAWLER_USER_AGENTS,
          allow: ["/", "/llms.txt", "/llms-full.txt"],
          disallow: DISALLOWED_PATHS,
        },
      ],
      sitemap: `${resolveBaseUrl()}/sitemap.xml`,
    };
  }

  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
