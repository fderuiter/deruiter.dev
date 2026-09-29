import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt =
  "CRF Studio: Next-Gen Clinical Form & Protocol Designer | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.crf;
  return createSocialImageResponse({
    preset: "CLINICAL_SYSTEMS",
    category: "CLINICAL DATA SYSTEMS // EDC STUDIO",
    title: config.title,
    description: config.description,
    badge: "CDISC CDASH 2.2 // ODM-XML",
    tags: [
      "CDASH 2.2",
      "ODM-XML 1.3.2",
      "AST Edit Checks",
      "aCRF",
      "21 CFR Part 11",
    ],
    systemStatus: "STUDIO ONLINE // EDC READY",
  });
}
