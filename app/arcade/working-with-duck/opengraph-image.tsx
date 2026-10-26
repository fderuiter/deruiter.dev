import {
  ARCADE_SHOWCASE_CONTENT_TYPE,
  createGameImageResponse,
  gameCardAlt,
  isHalloweenCardSeason,
} from "@/lib/og-arcade-showcase";
import { OG_IMAGE_SIZE } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = gameCardAlt("working-with-duck");
export const size = OG_IMAGE_SIZE;
export const contentType = ARCADE_SHOWCASE_CONTENT_TYPE;
// The card follows the month (#2740), so it is rebuilt daily rather than
// fixed at build time: Duck's Halloween card through October, his everyday
// card the rest of the year. Daily rather than hourly, because each rebuild
// bills Vercel active CPU (#2971).
export const revalidate = 86400;

export default function Image() {
  return createGameImageResponse("working-with-duck", {
    halloween: isHalloweenCardSeason(new Date()),
  });
}
