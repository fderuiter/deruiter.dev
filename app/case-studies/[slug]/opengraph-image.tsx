import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { buildDossierChips, formatReadingTime } from "@/lib/og-dossier";

export const runtime = "nodejs";
export const alt = "Case Study Technical Deep-Dive | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

/**
 * Prerenders a card for every bundled case study. The card reads only bundled
 * text, so it can be built once instead of running Satori on every fetch.
 */
export function generateStaticParams() {
  return FALLBACK_CASE_STUDIES.map((study) => ({ slug: study.slug }));
}

interface ImageProps {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { slug } = await params;

  // Find matching config in ROUTE_METADATA_CONFIGS by canonical path
  const config = Object.values(ROUTE_METADATA_CONFIGS).find(
    (c) => c.path === `/case-studies/${slug}` || c.path === `/work/${slug}`
  );

  const title = config?.title || `Technical Case Study: ${slug}`;
  const description =
    config?.description ||
    "In-depth technical architecture breakdown and verifiable systems design.";
  const tags = config?.keywords?.slice(0, 5) || [
    "Architecture",
    "TypeScript",
    "Systems",
    "Case Study",
  ];

  // Bundled case-study text only: a social card must never wake the database.
  const study = FALLBACK_CASE_STUDIES.find((c) => c.slug === slug);

  return createSocialImageResponse({
    preset: "SYSTEMS_ARCHITECTURE",
    dossier: study
      ? buildDossierChips({
          readingTime: formatReadingTime(
            `${study.editorial_content} ${study.architectural_narrative}`
          ),
          publishedAt: study.created_at,
          language: study.primary_language,
          verified: true,
        })
      : undefined,
    category: "ENGINEERING CASE STUDY // ARCHITECTURAL BREAKDOWN",
    title,
    description,
    badge: `SYS-CASE // ${slug.toUpperCase()}`,
    tags,
    systemStatus: "VERIFIED ARCHITECTURE // PRODUCTION READY",
  });
}
