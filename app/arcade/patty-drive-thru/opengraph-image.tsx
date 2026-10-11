import {
  ARCADE_SHOWCASE_CONTENT_TYPE,
  createGameImageResponse,
  gameCardAlt,
} from "@/lib/og-arcade-showcase";
import { OG_IMAGE_SIZE } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = gameCardAlt("patty-drive-thru");
export const size = OG_IMAGE_SIZE;
export const contentType = ARCADE_SHOWCASE_CONTENT_TYPE;

export default function Image() {
  return createGameImageResponse("patty-drive-thru");
}
