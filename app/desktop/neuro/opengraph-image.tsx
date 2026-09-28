import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt =
  "NeuroRecon: FreeSurfer Pipeline Simulator & QA Studio | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.neuro;
  return createSocialImageResponse({
    category: "NEUROIMAGING CAD // PIPELINE STUDIO",
    title: config.title,
    description: config.description,
    badge: "FREESURFER 7.4 // 3D CAD",
    tags: [
      "FreeSurfer",
      "3D Cortical Mesh",
      "MRI Orthoviews",
      "Euler Topological QA",
      "Desikan-Killiany",
    ],
    systemStatus: "3D CAD READY // PIPELINE ONLINE",
  });
}
