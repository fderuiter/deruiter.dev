import type { MetadataRoute } from "next";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { getAllPublishedBlogPosts } from "@/lib/blog";
import { resolveBaseUrl } from "@/lib/domain";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getRouteLastModified } from "@/lib/fs-stat-mapping";

export const revalidate = 86400;

export const STATIC_ROUTE_LAST_MODIFIED = new Date("2026-08-14T00:00:00Z");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = resolveBaseUrl();
  const serverGenerationDate = new Date();
  const sitemapMap = new Map<string, MetadataRoute.Sitemap[number]>();

  const resolveStaticDate = (routePath: string) => {
    return getRouteLastModified(routePath, serverGenerationDate);
  };

  // 1. Root and Hub entries
  sitemapMap.set(baseUrl, {
    url: baseUrl,
    lastModified: resolveStaticDate("/"),
    changeFrequency: "daily",
    priority: 1.0,
  });

  sitemapMap.set(`${baseUrl}/case-studies`, {
    url: `${baseUrl}/case-studies`,
    lastModified: resolveStaticDate("/case-studies"),
    changeFrequency: "weekly",
    priority: 0.9,
  });

  sitemapMap.set(`${baseUrl}/arcade`, {
    url: `${baseUrl}/arcade`,
    lastModified: resolveStaticDate("/arcade"),
    changeFrequency: "weekly",
    priority: 0.9,
  });

  // 2. Derive all registered route entries from ROUTE_METADATA_CONFIGS (excluding /offline)
  for (const config of Object.values(ROUTE_METADATA_CONFIGS)) {
    if (config.path === "/offline") continue;
    const url = `${baseUrl}${config.path.startsWith("/") ? config.path : "/" + config.path}`;

    let priority = 0.8;
    let changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] =
      "weekly";

    if (
      config.path === "/crf" ||
      config.path === "/patrol" ||
      config.path === "/stack" ||
      config.path === "/work/laser-loon"
    ) {
      priority = 0.9;
    } else if (config.path === "/merch") {
      priority = 0.4;
      changeFrequency = "monthly";
    } else if (config.path === "/acknowledgments") {
      priority = 0.5;
      changeFrequency = "monthly";
    } else if (config.path === "/schedule" || config.path === "/contact") {
      priority = 0.8;
      changeFrequency = "monthly";
    }

    sitemapMap.set(url, {
      url,
      lastModified: resolveStaticDate(config.path),
      changeFrequency,
      priority,
    });
  }

  // 3. Fetch all published case studies to dynamically attach or update dynamic case study URLs
  const studies = await CaseStudyService.getAllPublishedCaseStudies();
  for (const study of studies) {
    const url = `${baseUrl}/case-studies/${study.slug}`;
    sitemapMap.set(url, {
      url,
      lastModified: study.updated_at,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // 4. Fetch all published blog posts to attach dynamic blog post URLs.
  // Returns an empty array until #760 (M3) lands `BlogPostService` — the
  // `/blog` index itself is already covered by step 2 via ROUTE_METADATA_CONFIGS.
  const posts = await getAllPublishedBlogPosts();
  for (const post of posts) {
    const url = `${baseUrl}/blog/${post.slug}`;
    sitemapMap.set(url, {
      url,
      lastModified: post.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return Array.from(sitemapMap.values());
}
