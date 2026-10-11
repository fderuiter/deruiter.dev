import {
  ARCADE_SHOWCASE_ALT,
  ARCADE_SHOWCASE_CONTENT_TYPE,
  createArcadeShowcaseImageResponse,
} from "@/lib/og-arcade-showcase";
import { OG_IMAGE_SIZE } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = ARCADE_SHOWCASE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = ARCADE_SHOWCASE_CONTENT_TYPE;

export default function Image() {
  return createArcadeShowcaseImageResponse();
}
