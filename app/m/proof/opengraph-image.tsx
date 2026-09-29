import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Mobile Formal Proof Workspace | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "FORMAL VERIFICATION & PROOF DAGS",
    title: "Mobile Logical Proof Workspace",
    description:
      "Touch-optimized formal logic proof workspace offering interactive deduction step ledgers and fallacy diagnostics.",
    badge: "MOBILE PROOF // TOUCH",
    tags: [
      "Touch Deductions",
      "Formal Logic",
      "Fallacy Diagnostics",
      "Theorem Assistant",
    ],
    systemStatus: "TOUCH ENGINE ACTIVE",
  });
}
