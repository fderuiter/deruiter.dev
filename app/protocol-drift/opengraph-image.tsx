import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt =
  "Protocol Drift, a clinical data pipeline simulation for CDISC SDTM and ADaM | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.protocolDrift;
  return createSocialImageResponse({
    category: "SYSTEMS // CDISC REGULATORY SIMULATOR",
    title: "Protocol Drift",
    description: `Design the trial. Debug reality. ${config.description}`,
    badge: "SDTM // ADaM LANES",
    tags: [
      "Node-Graph Pipeline",
      "Web Worker Engine",
      "Protocol Amendment",
      "Database Lock",
      "Deterministic",
    ],
    systemStatus: "WALL HOLDS // LOCK PENDING",
  });
}
