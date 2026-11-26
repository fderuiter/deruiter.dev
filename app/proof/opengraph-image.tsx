import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Interactive Proof Studio | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "FORMAL VERIFICATION & PROOF DAGS",
    title: "Interactive Deductive Proof & Theorem Studio",
    description:
      "Explore Directed Acyclic Graph (DAG) theorem proofs with real-time fallacy detection, topological node traversal, and verification exports.",
    badge: "PROOF ENGINE // V2",
    tags: [
      "DAG Physics",
      "Formal Logic",
      "Canvas Topology",
      "LaTeX Renderer",
      "Topological Sort",
    ],
    systemStatus: "VERIFICATION ENGINE READY",
  });
}
