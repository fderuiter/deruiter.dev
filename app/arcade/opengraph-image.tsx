import { ARCADE_GAME_COUNT } from "@/lib/arcade";
import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Arcade Experience Hub | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "ARCADE SYSTEMS & SIMULATORS",
    title: "Interactive Game Engines & Physics Simulators",
    description:
      "Play custom-built canvas arcade games including Laser Loon, Quasi-Puzzler, Duck Engine, and Clinical Chaos.",
    badge: `ARCADE // ${ARCADE_GAME_COUNT} GAMES`,
    tags: [
      "Raycasting",
      "Canvas 2D",
      "Web Audio API",
      "Deterministic Physics",
      "State Machines",
    ],
    systemStatus: "ARCADE ENGINES ONLINE",
  });
}
