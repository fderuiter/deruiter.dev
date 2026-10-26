import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";
export const runtime = "nodejs";
export const alt =
  "In-browser SQL workbench over a governed clinical warehouse | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export default function Image() {
  return createSocialImageResponse({
    category: "CLINICAL DATA PLATFORM",
    title: "Query the warehouse",
    description:
      "Run read-only SQL on the gold tables in your browser, with DuckDB compiled to WebAssembly.",
    badge: "SQL // SYNTHETIC",
    tags: ["DuckDB-WASM", "Read-only", "Saved queries", "Three dialects"],
    systemStatus: "IN-BROWSER ENGINE",
  });
}
