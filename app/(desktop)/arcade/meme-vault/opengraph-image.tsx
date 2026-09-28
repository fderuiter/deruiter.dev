import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt =
  "Secret Meme Vault & Developer Soundboard | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "ENGINEERING ARCADE // SECRET CHAMBER",
    title: "Secret Meme Vault & Developer Soundboard",
    description:
      "Synthesized Web Audio sound effects, Easter egg achievement trophies, and interactive engineering memes.",
    badge: "CLASSIFIED // UNLOCKED",
    tags: [
      "Web Audio API",
      "Easter Eggs",
      "Soundboard",
      "CRT Shader",
      "React 19",
    ],
    systemStatus: "MEME PROTOCOL ACTIVE",
  });
}
