import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt =
  "Trial & Error: Biostat Ops, a clinical-output deckbuilder | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.trialAndError;
  return createSocialImageResponse({
    category: "ENGINEERING ARCADE // BIOSTATISTICS",
    title: config.title,
    description: config.description,
    badge: "SAP QC // CHIPS × MULT",
    tags: [
      "Deckbuilder",
      "SAP Rulebooks",
      "TLF QC",
      "Deterministic Scoring",
      "Zod",
    ],
    systemStatus: "QC DESK OPEN // SMALL BLIND",
  });
}
