import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt =
  "Study Director: Everything Is Fine, a clinical study management simulator | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.studyDirector;
  return createSocialImageResponse({
    category: "ENGINEERING ARCADE // CLINICAL OPERATIONS",
    title: config.title,
    description: config.description,
    badge: "8 ATTENTION // 6 METERS",
    tags: [
      "Simulation",
      "Attention Budget",
      "Documentation Debt",
      "FDA Inspection",
      "Deterministic",
    ],
    systemStatus: "DASHBOARD GREEN // AUDIT PENDING",
  });
}
