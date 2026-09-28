import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt =
  "Clinical Trial Chaos: CDISC Compliance Arcade | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.clinicalChaos;
  return createSocialImageResponse({
    category: "ENGINEERING ARCADE // CLINICAL COMPLIANCE",
    title: config.title,
    description: config.description,
    badge: "CDISC COMPLIANCE // GxP",
    tags: [
      "CDISC SDTM",
      "ODM-XML",
      "21 CFR Part 11",
      "Audit Simulator",
      "Canvas 2D",
    ],
    systemStatus: "AUDIT ACTIVE // GxP VERIFIED",
  });
}
