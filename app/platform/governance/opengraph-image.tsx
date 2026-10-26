import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
export const runtime = "nodejs";
export const alt =
  "Data catalog, business glossary and stewardship for a clinical data platform | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL DATA PLATFORM",
    title: "Govern the data",
    description:
      "Every data product and governed metric with its owner, steward, contract and quality score, beside the glossary and RACI.",
    badge: "GOVERNANCE // SYNTHETIC",
    tags: ["Data catalog", "Glossary", "Stewardship", "Policies"],
    systemStatus: "CATALOG + RACI",
  });
}
