import { BaseCaseStudy } from "@/types/domain";
import { GitHubStats } from "@/lib/github";
import type { BlogPost, BlogPostSummary } from "@/lib/blog/types";
import { CONTENT_PILLAR_CATALOG } from "@/lib/blog/presets";
import { resolveBaseUrl } from "./domain";

export const SITE_BASE_URL = resolveBaseUrl();

export const PERSON_NODE_ID = `${SITE_BASE_URL}/#person`;
export const WEBSITE_NODE_ID = `${SITE_BASE_URL}/#website`;

/**
 * Returns the canonical Person Schema.org entity node with #person @id.
 */
export function getPersonNode(options?: {
  inLanguage?: string;
  isAccessibleForFree?: boolean;
}): Record<string, unknown> {
  return {
    "@type": "Person",
    "@id": PERSON_NODE_ID,
    name: "Frederick de Ruiter",
    url: SITE_BASE_URL,
    image: `${SITE_BASE_URL}/favicon.ico`,
    jobTitle: "Principal Systems Engineer & Designer",
    inLanguage: options?.inLanguage || "en-US",
    isAccessibleForFree: options?.isAccessibleForFree ?? true,
    sameAs: [
      "https://github.com/fderuiter",
      "https://www.linkedin.com/in/frederick-de-ruiter-88012467/",
    ],
    knowsAbout: [
      "Systems Architecture",
      "CDISC CDASH & ODM-XML",
      "Formal Verification",
      "Embedded Systems",
      "Next.js 16 & React 19",
      "TypeScript & Rust",
    ],
  };
}

/**
 * Returns the canonical WebSite Schema.org entity node with `#website` `@id` and Sitelinks SearchAction.
 */
export function getWebsiteNode(options?: {
  inLanguage?: string;
  isAccessibleForFree?: boolean;
}): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_NODE_ID,
    name: "Frederick de Ruiter Portfolio",
    url: SITE_BASE_URL,
    description:
      "Clinical data tools, software projects, and browser games by Frederick de Ruiter.",
    inLanguage: options?.inLanguage || "en-US",
    isAccessibleForFree: options?.isAccessibleForFree ?? true,
    publisher: {
      "@type": "Person",
      "@id": PERSON_NODE_ID,
      name: "Frederick de Ruiter",
    },
    author: {
      "@type": "Person",
      "@id": PERSON_NODE_ID,
      name: "Frederick de Ruiter",
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_BASE_URL}/?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export interface WebPageNodeOptions {
  name: string;
  description: string;
  url: string;
  breadcrumbs?: BreadcrumbItem[];
  inLanguage?: string;
  isAccessibleForFree?: boolean;
}

/** A visible question and answer pair rendered by the FAQ accordion. */
export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Returns a Schema.org `FAQPage` node for the given items. The items must be
 * the same ones rendered visibly on the page (Google's anti-cloaking rule).
 */
export function getFAQPageNode(
  items: readonly FAQItem[],
  pageUrl: string
): Record<string, unknown> {
  const fullUrl = pageUrl.startsWith("http")
    ? pageUrl
    : `${SITE_BASE_URL}${pageUrl.startsWith("/") ? pageUrl : "/" + pageUrl}`;
  return {
    "@type": "FAQPage",
    "@id": `${fullUrl}/#faq`,
    url: fullUrl,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * Returns a canonical WebPage entity node linked to the root WebSite and Person.
 */
export function getWebPageNode(
  options: WebPageNodeOptions
): Record<string, unknown> {
  const fullUrl = options.url.startsWith("http")
    ? options.url
    : `${SITE_BASE_URL}${options.url.startsWith("/") ? options.url : "/" + options.url}`;
  return {
    "@type": "WebPage",
    "@id": `${fullUrl}/#webpage`,
    url: fullUrl,
    name: options.name,
    description: options.description,
    inLanguage: options.inLanguage || "en-US",
    isAccessibleForFree: options.isAccessibleForFree ?? true,
    isPartOf: {
      "@id": WEBSITE_NODE_ID,
    },
    author: {
      "@id": PERSON_NODE_ID,
    },
    ...(options.breadcrumbs
      ? { breadcrumb: { "@id": `${fullUrl}/#breadcrumb` } }
      : {}),
  };
}

/**
 * Returns a normalized BreadcrumbList entity node with explicit #breadcrumb @id.
 */
export function getBreadcrumbNode(
  items: BreadcrumbItem[],
  pageUrl: string,
  options?: { inLanguage?: string; isAccessibleForFree?: boolean }
): Record<string, unknown> {
  const normalized = normalizeBreadcrumbs(items);
  const fullPageUrl = pageUrl.startsWith("http")
    ? pageUrl
    : `${SITE_BASE_URL}${pageUrl.startsWith("/") ? pageUrl : "/" + pageUrl}`;
  return {
    "@type": "BreadcrumbList",
    "@id": `${fullPageUrl}/#breadcrumb`,
    inLanguage: options?.inLanguage || "en-US",
    isAccessibleForFree: options?.isAccessibleForFree ?? true,
    itemListElement: normalized.map((item, index) => {
      const formattedUrl = item.url.startsWith("http")
        ? item.url
        : `${SITE_BASE_URL}${item.url.startsWith("/") ? item.url : "/" + item.url}`;
      return {
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: formattedUrl,
      };
    }),
  };
}

export interface VisualArtworkSchemaOptions {
  name: string;
  description: string;
  url: string;
  imageUrl?: string;
  formats?: string[];
  license?: string;
  creator?: string;
  inLanguage?: string;
  isAccessibleForFree?: boolean;
}

/**
 * Returns a specialized VisualArtwork & MediaObject Schema.org representation for open graphic design assets (e.g. Laser Loon).
 */
export function getVisualArtworkNode(
  options: VisualArtworkSchemaOptions
): Record<string, unknown> {
  const fullUrl = options.url.startsWith("http")
    ? options.url
    : `${SITE_BASE_URL}${options.url.startsWith("/") ? options.url : "/" + options.url}`;
  return {
    "@type": "VisualArtwork",
    "@id": `${fullUrl}/#artwork`,
    name: options.name,
    description: options.description,
    url: fullUrl,
    inLanguage: options.inLanguage || "en-US",
    isAccessibleForFree: options.isAccessibleForFree ?? true,
    image: options.imageUrl || `${SITE_BASE_URL}/images/laser-loon-preview.png`,
    encodingFormat: options.formats || [
      "image/svg+xml",
      "application/illustrator",
      "application/pdf",
      "image/png",
    ],
    license: options.license || "https://creativecommons.org/licenses/by/4.0/",
    creator: {
      "@type": "Person",
      "@id": PERSON_NODE_ID,
      name: options.creator || "Frederick de Ruiter",
    },
  };
}

export function getVisualArtworkSchema(
  options: VisualArtworkSchemaOptions
): string {
  const schema = {
    "@context": "https://schema.org",
    ...getVisualArtworkNode(options),
  };

  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

/**
 * Returns an interconnected Schema.org `@graph` linking all provided entity nodes into a single structured payload.
 */
export function getUnifiedGraphSchema(
  nodes: (Record<string, unknown> | null | undefined)[],
  options?: { inLanguage?: string; isAccessibleForFree?: boolean }
): string {
  const defaultInLanguage = options?.inLanguage || "en-US";
  const defaultIsAccessibleForFree = options?.isAccessibleForFree ?? true;

  const filteredNodes = nodes
    .filter((n): n is Record<string, unknown> => Boolean(n))
    .map((node) => ({
      inLanguage: (node.inLanguage as string) || defaultInLanguage,
      isAccessibleForFree:
        (node.isAccessibleForFree as boolean) ?? defaultIsAccessibleForFree,
      ...node,
    }));

  const schema = {
    "@context": "https://schema.org",
    "@graph": filteredNodes,
  };

  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

/**
 * Returns the canonical Person schema representing Frederick de Ruiter.
 * Securely escapes angle brackets to neutralize potential XSS script injections.
 */
export function getPersonSchema(options?: {
  inLanguage?: string;
  isAccessibleForFree?: boolean;
}): string {
  const schema = {
    "@context": "https://schema.org",
    ...getPersonNode(options),
  };

  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

/**
 * Returns the root WebSite schema.
 */
export function getWebsiteSchema(options?: {
  inLanguage?: string;
  isAccessibleForFree?: boolean;
}): string {
  const schema = {
    "@context": "https://schema.org",
    ...getWebsiteNode(options),
  };

  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

export interface WebApplicationSchemaOptions {
  name: string;
  description: string;
  url: string;
  applicationCategory:
    | "GameApplication"
    | "DeveloperApplication"
    | "EducationalApplication"
    | "MultimediaApplication"
    | "SimulationApplication";
  operatingSystem?: string;
  genre?: string;
  browserRequirements?: string;
  inLanguage?: string;
  isAccessibleForFree?: boolean;
}

/**
 * Returns a specialized WebApplication entity node for interactive games, proof tools, and simulators.
 */
export function getWebApplicationNode(
  options: WebApplicationSchemaOptions
): Record<string, unknown> {
  const fullUrl = options.url.startsWith("http")
    ? options.url
    : `${SITE_BASE_URL}${options.url.startsWith("/") ? options.url : "/" + options.url}`;
  return {
    "@type": "WebApplication",
    name: options.name,
    description: options.description,
    url: fullUrl,
    inLanguage: options.inLanguage || "en-US",
    isAccessibleForFree: options.isAccessibleForFree ?? true,
    applicationCategory: options.applicationCategory,
    operatingSystem:
      options.operatingSystem ||
      "Any modern web browser (HTML5, Canvas 2D, Web Audio API)",
    browserRequirements:
      options.browserRequirements ||
      "Requires JavaScript. Requires HTML5 Canvas support.",
    ...(options.genre ? { genre: options.genre } : {}),
    author: {
      "@type": "Person",
      name: "Frederick de Ruiter",
    },
  };
}

/**
 * Returns a specialized WebApplication schema for interactive games, proof tools, and simulators.
 */
export function getWebApplicationSchema(
  options: WebApplicationSchemaOptions
): string {
  const schema = {
    "@context": "https://schema.org",
    ...getWebApplicationNode(options),
  };

  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Normalizes breadcrumb items to enforce a single root location entry across all routes and schemas.
 * Strips any initial or duplicate root entries (links to "/", empty string, SITE_BASE_URL, or named "Home")
 * and prepends exactly one root location entry ({ name: "Home", url: "/" }).
 */
export function normalizeBreadcrumbs(
  items: BreadcrumbItem[]
): BreadcrumbItem[] {
  const isRootItem = (item: BreadcrumbItem) => {
    const nameLower = (item.name || "").trim().toLowerCase();
    const urlTrim = (item.url || "").trim();
    return (
      nameLower === "home" ||
      (item.url !== undefined &&
        (urlTrim === "/" ||
          urlTrim === SITE_BASE_URL ||
          urlTrim === `${SITE_BASE_URL}/`))
    );
  };

  const filtered = (items || []).filter((item) => !isRootItem(item));
  return [{ name: "Home", url: "/" }, ...filtered];
}

/**
 * Returns a Schema.org BreadcrumbList for hierarchical page navigation.
 * Enforces a single root location entry and securely sanitizes angle brackets against script injection.
 */
export function getBreadcrumbSchema(
  items: BreadcrumbItem[],
  options?: { inLanguage?: string; isAccessibleForFree?: boolean }
): string {
  const normalized = normalizeBreadcrumbs(items);
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    inLanguage: options?.inLanguage || "en-US",
    isAccessibleForFree: options?.isAccessibleForFree ?? true,
    itemListElement: normalized.map((item, index) => {
      const formattedUrl = item.url.startsWith("http")
        ? item.url
        : `${SITE_BASE_URL}${item.url.startsWith("/") ? item.url : "/" + item.url}`;
      return {
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: formattedUrl,
      };
    }),
  };

  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

export interface CollectionItem {
  name: string;
  url: string;
  description?: string;
}

/**
 * Returns a CollectionPage entity node.
 */
export function getCollectionPageNode(
  name: string,
  description: string,
  url: string,
  items: CollectionItem[],
  options?: { inLanguage?: string; isAccessibleForFree?: boolean }
): Record<string, unknown> {
  const fullUrl = url.startsWith("http")
    ? url
    : `${SITE_BASE_URL}${url.startsWith("/") ? url : "/" + url}`;
  return {
    "@type": "CollectionPage",
    name: name,
    description: description,
    url: fullUrl,
    inLanguage: options?.inLanguage || "en-US",
    isAccessibleForFree: options?.isAccessibleForFree ?? true,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: item.url.startsWith("http")
          ? item.url
          : `${SITE_BASE_URL}${item.url.startsWith("/") ? item.url : "/" + item.url}`,
        ...(item.description ? { description: item.description } : {}),
      })),
    },
    author: {
      "@type": "Person",
      name: "Frederick de Ruiter",
    },
  };
}

/**
 * Returns a Schema.org CollectionPage schema for hub and directory views.
 */
export function getCollectionPageSchema(
  name: string,
  description: string,
  url: string,
  items: CollectionItem[],
  options?: { inLanguage?: string; isAccessibleForFree?: boolean }
): string {
  const schema = {
    "@context": "https://schema.org",
    ...getCollectionPageNode(name, description, url, items, options),
  };

  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

/**
 * Returns a specialized SoftwareSourceCode entity node for dynamic Case Studies.
 */
export function getSoftwareSourceCodeNode(
  study: BaseCaseStudy,
  stats: Partial<GitHubStats> | null,
  options?: { inLanguage?: string; isAccessibleForFree?: boolean }
): Record<string, unknown> {
  const cleanDescription = study.editorial_content
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\*/g, "");

  return {
    "@type": "SoftwareSourceCode",
    name: study.title,
    description: cleanDescription,
    inLanguage: options?.inLanguage || "en-US",
    isAccessibleForFree: options?.isAccessibleForFree ?? true,
    codeRepository: study.github_url || undefined,
    programmingLanguage: study.primary_language,
    author: {
      "@type": "Person",
      name: "Frederick de Ruiter",
    },
    interactionStatistic:
      stats &&
      typeof stats.stars === "number" &&
      typeof stats.forks === "number"
        ? [
            {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/LikeAction",
              userInteractionCount: stats.stars,
            },
            {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/ForkAction",
              userInteractionCount: stats.forks,
            },
          ]
        : undefined,
  };
}

/**
 * Returns a specialized SoftwareSourceCode schema for dynamic Case Studies.
 * Integrates database case study records with cached live GitHub telemetry statistics.
 */
export function getSoftwareSourceCodeSchema(
  study: BaseCaseStudy,
  stats: Partial<GitHubStats> | null,
  options?: { inLanguage?: string; isAccessibleForFree?: boolean }
): string {
  const schema = {
    "@context": "https://schema.org",
    ...getSoftwareSourceCodeNode(study, stats, options),
  };

  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

export interface BlogPostingNodeOptions {
  inLanguage?: string;
  isAccessibleForFree?: boolean;
}

/**
 * Returns a Schema.org BlogPosting entity node for technical blog dispatches.
 */
export function getBlogPostingNode(
  post: BlogPostSummary | BlogPost,
  options?: BlogPostingNodeOptions
): Record<string, unknown> {
  const fullUrl = `${SITE_BASE_URL}/blog/${post.slug}`;
  const ogImageUrl = post.heroImageUrl || `${fullUrl}/opengraph-image`;

  const node: Record<string, unknown> = {
    "@type": "BlogPosting",
    "@id": `${fullUrl}#blogposting`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": fullUrl,
    },
    headline: post.title,
    description: post.dek,
    url: fullUrl,
    image: ogImageUrl,
    datePublished:
      post.publishedAt instanceof Date
        ? post.publishedAt.toISOString()
        : String(post.publishedAt),
    dateModified:
      post.updatedAt instanceof Date
        ? post.updatedAt.toISOString()
        : String(post.updatedAt),
    author: {
      "@type": "Person",
      "@id": PERSON_NODE_ID,
      name: "Frederick de Ruiter",
      url: SITE_BASE_URL,
    },
    publisher: {
      "@type": "Person",
      "@id": PERSON_NODE_ID,
      name: "Frederick de Ruiter",
      url: SITE_BASE_URL,
    },
    articleSection: CONTENT_PILLAR_CATALOG[post.pillar]?.label || post.pillar,
    keywords: Array.isArray(post.tags)
      ? post.tags.join(", ")
      : String(post.tags || ""),
    inLanguage: options?.inLanguage || "en-US",
    isAccessibleForFree: options?.isAccessibleForFree ?? true,
  };

  if (
    typeof post.readingTimeMinutes === "number" &&
    Number.isFinite(post.readingTimeMinutes) &&
    post.readingTimeMinutes > 0
  ) {
    node.timeRequired = `PT${post.readingTimeMinutes}M`;
  }

  if ("body" in post && typeof post.body === "string" && post.body) {
    const textOnly = post.body.replace(/<[^>]*>/g, "").trim();
    const wordCount = textOnly.split(/\s+/).filter(Boolean).length;
    if (wordCount > 0) {
      node.wordCount = wordCount;
    }
  }

  return node;
}

/**
 * Returns a Schema.org BlogPosting JSON-LD string with angle brackets escaped against script injection.
 */
export function getBlogPostingSchema(
  post: BlogPostSummary | BlogPost,
  options?: BlogPostingNodeOptions
): string {
  const schema = {
    "@context": "https://schema.org",
    ...getBlogPostingNode(post, options),
  };

  return JSON.stringify(schema).replace(/</g, "\\u003c");
}
