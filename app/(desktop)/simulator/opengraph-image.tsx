import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Engineering Alignment Simulator | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "SYSTEMS ALIGNMENT SIMULATION",
    title: "Interactive Engineering Alignment Assessment",
    description:
      "Simulate engineering scenarios, architectural tradeoffs, and team alignment dynamics with immediate archetype profiling and scorecards.",
    badge: "SIMULATOR // ACTIVE",
    tags: [
      "State Machines",
      "Archetype Scoring",
      "Decision Trees",
      "Interactive UI",
      "PDF Export",
    ],
    systemStatus: "SIMULATION MATRIX ONLINE",
  });
}
