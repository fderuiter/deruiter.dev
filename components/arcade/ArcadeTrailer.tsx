import React from "react";
import { IconMovie } from "@tabler/icons-react";

const TRAILER_SRC = "/videos/arcade-sizzle.mp4";
const TRAILER_WEBM = "/videos/arcade-sizzle.webm";
const TRAILER_POSTER = "/videos/arcade-sizzle-poster.jpg";
const TRAILER_CAPTIONS = "/videos/arcade-sizzle.vtt";

/**
 * The arcade's sizzle reel: 58 seconds of real play from every cabinet,
 * cut on the beat. It never autoplays and preloads nothing, so it costs the
 * page no bandwidth or audio until a visitor presses play (#1788, #2030).
 */
export function ArcadeTrailer() {
  return (
    <section
      aria-labelledby="arcade-trailer-heading"
      className="mx-auto mb-16 max-w-4xl min-w-0"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="arcade-trailer-heading"
          className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-zinc-300"
        >
          <IconMovie className="h-4 w-4 text-amber-400" aria-hidden="true" />
          Trailer
        </h2>
        <span className="font-mono text-[11px] text-zinc-400">
          0:58 · real gameplay
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0e11]">
        <video
          className="block aspect-video h-auto w-full"
          controls
          playsInline
          preload="none"
          poster={TRAILER_POSTER}
          aria-describedby="arcade-trailer-credit"
          data-testid="arcade-trailer"
        >
          <source src={TRAILER_SRC} type="video/mp4" />
          {/* Chromium builds without H.264 fall back to VP9. */}
          <source src={TRAILER_WEBM} type="video/webm" />
          <track
            kind="captions"
            src={TRAILER_CAPTIONS}
            srcLang="en"
            label="English"
          />
          <a href={TRAILER_SRC} className="text-brand-cyan underline">
            Download the arcade trailer (MP4)
          </a>
        </video>
      </div>
      <p
        id="arcade-trailer-credit"
        className="mt-3 font-mono text-[11px] leading-relaxed text-zinc-400 break-words"
      >
        A 58-second sizzle reel of every game, recorded straight from this site.
        Music: &ldquo;Generic trailer music&rdquo; by emmama (CC0).
      </p>
    </section>
  );
}
