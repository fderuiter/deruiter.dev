import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Study Data Pipeline | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "STUDY DATA PIPELINE",
    title: "USDM to TLFs, traced end to end",
    description:
      "One synthetic study, from collected data through SDTM, conformance checks, ADaM and Define-XML to tables and a Kaplan-Meier figure.",
    badge: "PIPELINE // SYNTHETIC",
    tags: ["USDM", "SDTM", "ADaM", "Lineage"],
    systemStatus: "RUNS IN YOUR BROWSER",
  });
}
