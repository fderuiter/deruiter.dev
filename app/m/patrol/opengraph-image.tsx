import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Mobile Ski Patrol Shift Studio | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "OPERATIONAL TRIAGE & SIMULATION",
    title: "Mobile Ski Patrol Shift Studio",
    description:
      "Touch-optimized ski patrol operational judgment simulator built for mobile screens, allowing real-time triage and emergency intervention decisions.",
    badge: "MOBILE PATROL // TOUCH",
    tags: [
      "Triage Cards",
      "Intervention Touch",
      "Emergency Operations",
      "FSM Engine",
    ],
    systemStatus: "PATROL DISPATCH ACTIVE",
  });
}
