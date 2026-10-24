import fs from "node:fs";
import path from "node:path";
import type { ReactElement, ReactNode } from "react";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { ARCADE_GAME_COUNT } from "@/lib/arcade";
import { logger } from "@/lib/logger";
import {
  getOgFonts,
  OG_FALLBACK_IMAGE_PATH,
  OG_IMAGE_SIZE,
} from "@/lib/og-image";

/** Content type of the screenshot cards: JPEG keeps photographic cards far below the byte budget. */
export const ARCADE_SHOWCASE_CONTENT_TYPE = "image/jpeg";

/** Alt text for the site-wide and arcade hub link preview. */
export const ARCADE_SHOWCASE_ALT = `Screenshots of Laser Loon, Patty’s Drive-Thru, Retro Labyrinth and Working With Duck, beside the headline: ${ARCADE_GAME_COUNT} games you can play in your browser.`;

/** Arcade screenshots shown on the site-wide card, in reading order, with their short on-card labels. */
export const ARCADE_SHOWCASE_GAMES = [
  { slug: "laser-loon", label: "Laser Loon" },
  { slug: "patty-drive-thru", label: "Patty’s Drive-Thru" },
  { slug: "retro-labyrinth", label: "Retro Labyrinth" },
  { slug: "working-with-duck", label: "Working With Duck" },
] as const;

/** Copy for one game's link preview; the screenshot is `public/images/arcade/previews/<slug>.webp`. */
export interface GameCardCopy {
  title: string;
  tagline: string;
}

/** Link preview copy for every game with a shipped arcade screenshot, keyed by slug. */
export const GAME_CARD_COPY = {
  "working-with-duck": {
    title: "Working With Duck",
    tagline:
      "You have a deadline. Duck has a ball. Keep the project and the puppy happy.",
  },
  "laser-loon": {
    title: "Laser Loon",
    tagline:
      "Fly a laser-eyed loon from Lake Minnetonka to the State Capitol, blasting rival flags and red tape.",
  },
  "quasi-puzzler": {
    title: "Quasi-Perfect Puzzler",
    tagline:
      "Apply tactics to a proof tree until it is complete. You can skip a goal, but the score will notice.",
  },
  "garmin-watch": {
    title: "Monkey C Mayhem",
    tagline:
      "A 5K platformer on a Garmin watch. Pace your Body Battery, race the Saturday 5K, and beat the coach's time.",
  },
  "clinical-chaos": {
    title: "Clinical Trial Chaos",
    tagline:
      "Sort clinical data into SDTM domains and keep up with the conveyor belt. The auditor is watching.",
  },
  "trial-and-error": {
    title: "Trial & Error",
    tagline:
      "A deckbuilder where clinical outputs are the cards. Review tables against the SAP to beat regulatory Blinds.",
  },
  "study-director": {
    title: "Study Director",
    tagline:
      "Shepherd one clinical study from kickoff to closeout, and defend your decisions when the FDA arrives.",
  },
  "patty-drive-thru": {
    title: "Patty’s Drive-Thru",
    tagline:
      "One shift at the drive-thru window of a first job, in first person. Keep moving so the manager does not notice.",
  },
  "for-better-or-bulk": {
    title: "For Better or Bulk",
    tagline:
      "Set up our Costco wedding before 4:00. Grill the hot dogs, arrange the Kirkland roses, and don't leave with your brothers.",
  },
  "protocol-drift": {
    title: "Protocol Drift",
    tagline:
      "Wire a clinical data pipeline from site entry to SDTM and ADaM, then keep it honest through a protocol amendment.",
  },
  "retro-labyrinth": {
    title: "Retro Labyrinth",
    tagline:
      "An abandoned codebase, now with corridors. Dodge moving walls, wield developer weapons and find the boss.",
  },
  "meme-vault": {
    title: "Meme Vault",
    tagline:
      "A developer and MedTech easter-egg room: synthesized soundbites, site achievements and engineering memes.",
  },
} as const satisfies Record<string, GameCardCopy>;

/** A game slug with its own screenshot link preview. */
export type GameCardSlug = keyof typeof GAME_CARD_COPY;

/**
 * October link previews (#2740), for the games with a Halloween mode. Each
 * uses `public/images/arcade/previews/<slug>-halloween.webp`.
 */
export const GAME_CARD_HALLOWEEN_COPY = {
  "working-with-duck": {
    title: "Working With Duck",
    tagline:
      "Duck is dressed as a duck, and the trick-or-treaters are at the door. The deadline did not move.",
  },
} as const satisfies Partial<Record<GameCardSlug, GameCardCopy>>;

/** A game slug with an October link preview. */
export type HalloweenCardSlug = keyof typeof GAME_CARD_HALLOWEEN_COPY;

/** The site's home clock, so October ends after Halloween night in Minnesota, not at 7 PM. */
const HOME_TIME_ZONE = "America/Chicago";

/**
 * Whether the October link preview is in season: any moment of October on
 * the site's home clock (US Central). UTC would turn the card back at 7 PM
 * on Halloween itself.
 *
 * @param date - The moment to check.
 * @returns True through October in US Central time.
 */
export function isHalloweenCardSeason(date: Date): boolean {
  const month = new Intl.DateTimeFormat("en-US", {
    timeZone: HOME_TIME_ZONE,
    month: "numeric",
  }).format(date);
  return month === "10";
}

/** Options for one game's link preview. */
export interface GameCardOptions {
  /**
   * Render the October card. Seasonal cards, and a seasonal game's everyday
   * card, are cached for an hour rather than a year, so a crawler sees the
   * change of month.
   */
  halloween?: boolean;
}

/** How long a seasonal game's card may be cached, matching its route's revalidate. */
export const SEASONAL_CARD_MAX_AGE_SECONDS = 3600;

/** Alt text for one game's link preview. */
export function gameCardAlt(slug: GameCardSlug): string {
  const copy = GAME_CARD_COPY[slug];
  return `Screenshot of ${copy.title}, a browser game by Fred de Ruiter. ${copy.tagline}`;
}

const PREVIEW_DIRECTORY = ["public", "images", "arcade", "previews"] as const;
const SANS = "Lexend, sans-serif";
const MONO = "Geist Mono, monospace";
const TILE_WIDTH = 352;
const TILE_HEIGHT = 220;
const TILE_GAP = 14;
const HERO_WIDTH = 704;
const HERO_HEIGHT = 440;

const cardCache = new Map<string, Buffer>();

/** Screenshot as a JPEG data URI: Satori cannot decode the WebP files the hub serves. */
async function readScreenshot(slug: string): Promise<string> {
  const file = path.join(process.cwd(), ...PREVIEW_DIRECTORY, `${slug}.webp`);
  const jpeg = await sharp(fs.readFileSync(file))
    .jpeg({ quality: 88 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

function CardFrame({
  kicker,
  headline,
  headlineSize,
  body,
  textWidth,
  children,
}: {
  textWidth: number;
  kicker: string;
  headline: string;
  headlineSize: number;
  body: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 48,
        background: "#0d0e11",
        fontFamily: SANS,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: textWidth,
          height: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#f59e0b",
            fontFamily: MONO,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.14em",
          }}
        >
          {kicker}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              color: "#f4f4f6",
              fontSize: headlineSize,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.035em",
              flexWrap: "wrap",
              columnGap: Math.round(headlineSize * 0.26),
            }}
          >
            {/* One item per word, so Satori never breaks "Drive-Thru" at its hyphen. */}
            {headline.split(" ").map((word, index) => (
              <span key={`${word}-${index}`}>{word}</span>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              color: "#94a3b8",
              fontSize: 22,
              lineHeight: 1.4,
            }}
          >
            {body}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              display: "flex",
              width: 10,
              height: 10,
              borderRadius: 10,
              background: "#10b981",
            }}
          />
          <div
            style={{
              display: "flex",
              color: "#f4f4f6",
              fontFamily: MONO,
              fontSize: 16,
              letterSpacing: "0.1em",
            }}
          >
            FREE · NO DOWNLOAD
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Screenshot({
  src,
  width,
  height,
  label,
}: {
  src: string;
  width: number;
  height: number;
  label?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(255, 255, 255, 0.14)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img elements */}
      <img
        src={src}
        width={width}
        height={height}
        alt=""
        style={{ objectFit: "cover" }}
      />
      {label && (
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 10,
            bottom: 10,
            padding: "4px 10px",
            borderRadius: 6,
            background: "rgba(13, 14, 17, 0.85)",
            color: "#f4f4f6",
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

function fallbackRedirect(): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: OG_FALLBACK_IMAGE_PATH, "Cache-Control": "no-store" },
  });
}

function jpegResponse(body: Buffer, seasonal = false): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": ARCADE_SHOWCASE_CONTENT_TYPE,
      "Cache-Control": seasonal
        ? `public, max-age=${SEASONAL_CARD_MAX_AGE_SECONDS}, s-maxage=${SEASONAL_CARD_MAX_AGE_SECONDS}`
        : "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400",
    },
  });
}

/**
 * Lays a card out with Satori and encodes it with sharp as JPEG, because a PNG
 * of game screenshots is several times the 250 KB budget. Encoded cards are
 * kept in memory per server process. If the brand fonts or a screenshot cannot
 * be read, crawlers are redirected to the static fallback icon, as the other
 * cards do.
 */
async function renderJpegCard(
  cacheKey: string,
  build: () => Promise<ReactElement>,
  seasonal = false
): Promise<Response> {
  const cached = cardCache.get(cacheKey);
  if (cached) return jpegResponse(cached, seasonal);
  // getOgFonts logs its own failure once per process.
  const fonts = getOgFonts();
  if (fonts.length === 0) return fallbackRedirect();
  try {
    const png = await new ImageResponse(await build(), {
      ...OG_IMAGE_SIZE,
      fonts,
    }).arrayBuffer();
    const jpeg = await sharp(Buffer.from(png))
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    cardCache.set(cacheKey, jpeg);
    return jpegResponse(jpeg, seasonal);
  } catch (error) {
    logger.error("Screenshot link preview could not be rendered", error, {
      card: cacheKey,
    });
    return fallbackRedirect();
  }
}

/**
 * Renders the site-wide link preview: real arcade screenshots in a two by two
 * grid beside a short headline with the live game count.
 */
export function createArcadeShowcaseImageResponse(): Promise<Response> {
  return renderJpegCard("showcase", async () => {
    const screenshots = await Promise.all(
      ARCADE_SHOWCASE_GAMES.map((game) => readScreenshot(game.slug))
    );
    return (
      <CardFrame
        kicker="DERUITER.DEV"
        headline={`${ARCADE_GAME_COUNT} games you can play in your browser`}
        headlineSize={54}
        textWidth={380}
        body="Plus clinical research tools and a laser-eyed loon. By Fred de Ruiter."
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            width: TILE_WIDTH * 2 + TILE_GAP,
            gap: TILE_GAP,
          }}
        >
          {ARCADE_SHOWCASE_GAMES.map((game, index) => (
            <Screenshot
              key={game.slug}
              src={screenshots[index]!}
              width={TILE_WIDTH}
              height={TILE_HEIGHT}
              label={game.label}
            />
          ))}
        </div>
      </CardFrame>
    );
  });
}

/**
 * Renders one game's link preview: its arcade screenshot beside its title and
 * a one-line pitch. A game with a Halloween mode can ask for its October card.
 */
export function createGameImageResponse(
  slug: GameCardSlug,
  options: GameCardOptions = {}
): Promise<Response> {
  const seasonal = slug in GAME_CARD_HALLOWEEN_COPY;
  const halloween = seasonal && options.halloween === true;
  const key = halloween ? `${slug}-halloween` : slug;
  const copy: GameCardCopy = halloween
    ? GAME_CARD_HALLOWEEN_COPY[slug as HalloweenCardSlug]
    : GAME_CARD_COPY[slug];
  return renderJpegCard(
    key,
    async () => (
      <CardFrame
        kicker="DERUITER.DEV / ARCADE"
        headline={copy.title}
        headlineSize={copy.title.length > 16 ? 46 : 54}
        textWidth={360}
        body={copy.tagline}
      >
        <Screenshot
          src={await readScreenshot(key)}
          width={HERO_WIDTH}
          height={HERO_HEIGHT}
        />
      </CardFrame>
    ),
    seasonal
  );
}
