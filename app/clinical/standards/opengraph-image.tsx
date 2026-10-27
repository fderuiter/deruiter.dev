import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
export const runtime = "nodejs";
export const alt =
  "CDISC standards conformance: pinned versions, published versions and rule results | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL",
    title: "Standards conformance",
    description:
      "Every CDISC standard the pipeline uses, the version it is pinned to, and what CDISC CORE, official schemas and local rules found.",
    badge: "EVIDENCE // SYNTHETIC",
    tags: ["CDISC CORE", "SDTM", "ADaM", "USDM"],
    systemStatus: "RULE FAMILIES, LAYERED",
  });
}
