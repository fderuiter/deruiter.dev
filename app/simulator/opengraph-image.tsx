import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Architectural Archetype Simulator | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "ARCHITECTURE DECISION SIMULATION",
    title: "Architectural Archetype & Incident Triage",
    description:
      "Choose an architecture bias, triage a production outage and review an async pipeline, then see your archetype across Systems Rigor, UI/UX Craft, Resilience and Velocity.",
    badge: "SIMULATOR // ACTIVE",
    tags: [
      "State Machines",
      "Archetype Scoring",
      "Decision Trees",
      "Incident Triage",
      "Copy Report",
    ],
    systemStatus: "SIMULATION MATRIX ONLINE",
  });
}
