import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
export const runtime = "nodejs";
export const alt =
  "Labs: proof workspace, MRI viewer, incident and patrol simulators | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export default function Image() {
  return createSocialImageResponse({
    category: "LABS",
    title: "Studios and simulators",
    description:
      "Interactive tools outside clinical data: proofs, a 3D MRI viewer, an outage drill and a ski-patrol shift.",
    badge: "LABS // INTERACTIVE",
    tags: ["Proof Workspace", "NeuroRecon", "Incident Drill", "Patrol Shift"],
    systemStatus: "FOUR LABS",
  });
}
