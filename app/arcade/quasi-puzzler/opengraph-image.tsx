import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const runtime = "nodejs";
export const alt =
  "Quasi-Perfect Puzzler: Formal Verification Arcade | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  const config = ROUTE_METADATA_CONFIGS.quasiPuzzler;
  return createSocialImageResponse({
    category: "ENGINEERING ARCADE // FORMAL VERIFICATION",
    title: config.title,
    description: config.description,
    badge: "LEAN PROOF // AST LOGIC",
    tags: [
      "Lean Tactics",
      "AST Trees",
      "Deductive Proofs",
      "Type Theory",
      "Canvas Physics",
    ],
    systemStatus: "AST SOLVED // RAM STABLE",
  });
}
