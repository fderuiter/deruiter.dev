import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Mobile NeuroRecon Studio | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "NEUROIMAGING & MORPHOMETRY",
    title: "Mobile NeuroRecon Studio",
    description:
      "Touch-optimized neuroimaging structural morphometry viewer providing subcortical volumetric metrics and FreeSurfer recon status.",
    badge: "MOBILE NEURO // TOUCH",
    tags: [
      "Subcortical Metrics",
      "FreeSurfer Status",
      "Neuroimaging",
      "Morphometry Cards",
    ],
    systemStatus: "MOBILE NEURO ACTIVE",
  });
}
