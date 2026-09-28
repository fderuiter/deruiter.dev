import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt =
  "Designing for My Brother: Accessible Typography | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "ENGINEERING CASE STUDY // COGNITIVE ACCESSIBILITY",
    title: "Designing for My Brother: Accessible Typography & Cognitive UX",
    description:
      "A personal case study on replacing generic system fonts with a scientifically grounded typography stack: Lexend, Atkinson Hyperlegible, and OpenDyslexic with zero-CLS Pretext text reflow.",
    badge: "SYS-CASE // ACCESSIBILITY",
    tags: [
      "OpenDyslexic",
      "Atkinson Hyperlegible",
      "Lexend",
      "Pretext",
      "WCAG 2.1 AA",
    ],
    systemStatus: "VERIFIED ARCHITECTURE // WCAG 2.1 AA",
  });
}
