"use client";

import React, { useState } from "react";
import { IntentLink } from "@/components/ui/IntentLink";
import Image from "next/image";
import {
  IconArrowRight,
  IconCheck,
  IconDeviceDesktop,
  IconShare2,
} from "@tabler/icons-react";
import { copyToClipboard } from "@/lib/clipboard";
import { getArcadeRegistryEntry, phoneReadyGames } from "@/lib/arcade";
import { ARCADE_GAMES_METADATA } from "@/lib/arcade-data";
import { HIDDEN_ON_PHONE, PHONE_ONLY_BLOCK } from "./phone-readiness";

// The gate matches PHONE_QUERY (ADR 0061, narrowing ADR 0048): phones in
// either orientation and touch devices in a Split View pane narrower than
// 744px. Tablets get the game. A desktop window resized narrow keeps its fine
// pointer and still gets the game. It is decided in CSS rather than with
// matchMedia so the server-rendered HTML is already correct: no hydration
// flash of the cabinet on phones, or of the notice on desktops and tablets.

/** The games that play on a phone, from the registry (#2368). */
function phonePicks(gameId: string) {
  return phoneReadyGames()
    .filter((game) => game.slug !== gameId)
    .map((game) => ({
      title: game.name,
      blurb:
        ARCADE_GAMES_METADATA.find((meta) => meta.slug === game.slug)
          ?.subtitle ?? "",
      href: game.route,
    }));
}

type ShareState = "idle" | "copied" | "failed";

interface DesktopOnlyGateProps {
  /**
   * Arcade slug, e.g. "laser-loon": selects the gameplay preview image, and
   * the registry gives the name used in the notice.
   */
  gameId: string;
  children: React.ReactNode;
}

/**
 * Replaces a game's play area with a desktop-only notice on phones
 * (PHONE_QUERY). PlayCabinet adds it for every game the registry gates on
 * phones (#2368). The notice shows desktop gameplay, offers to save the link
 * for later, and points at the games that play on a phone. The route's
 * heading, description and metadata render unchanged, so shared links and
 * search previews still describe the game. "Try it anyway" reveals the
 * cabinet on this page.
 */
export function DesktopOnlyGate({ gameId, children }: DesktopOnlyGateProps) {
  const gameTitle = getArcadeRegistryEntry(gameId).name;
  const [override, setOverride] = useState(false);
  const [shareState, setShareState] = useState<ShareState>("idle");

  const handleSaveLink = async () => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: gameTitle,
          text: `${gameTitle}: play it on a desktop.`,
          url,
        });
        return;
      } catch (error) {
        // Dismissing the share sheet is a choice, not a failure.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }
    try {
      await copyToClipboard(url);
      setShareState("copied");
    } catch {
      setShareState("failed");
    }
  };

  if (override) return <>{children}</>;

  return (
    <div data-desktop-only-gate="" className="w-full min-w-0">
      <div className={HIDDEN_ON_PHONE}>{children}</div>
      <section
        className={PHONE_ONLY_BLOCK}
        aria-labelledby={`${gameId}-desktop-only-title`}
        data-testid="desktop-only-notice"
      >
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#13151a] text-left">
          <figure className="relative m-0 border-b border-zinc-800">
            <Image
              src={`/images/arcade/previews/${gameId}.webp`}
              alt={`${gameTitle} being played on a desktop`}
              width={800}
              height={500}
              loading="lazy"
              // Already-small WebP stills: skip the optimizer and its quota.
              unoptimized
              className="block aspect-[16/10] h-auto w-full object-cover"
            />
            <figcaption className="block border-t border-zinc-800 bg-[#0d0e11] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300">
              Desktop gameplay
            </figcaption>
          </figure>

          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <IconDeviceDesktop
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h2
                  id={`${gameId}-desktop-only-title`}
                  className="font-mono text-base font-bold tracking-[-0.035em] text-zinc-100 break-words"
                >
                  {gameTitle} needs a bigger screen
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                  It&apos;s built for a keyboard and a desktop-sized screen, and
                  on a phone it&apos;s cramped. Save the link and play it on
                  your laptop.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveLink}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 font-mono text-sm font-bold text-black active:scale-[0.98]"
            >
              {shareState === "copied" ? (
                <IconCheck className="h-4 w-4" aria-hidden="true" />
              ) : (
                <IconShare2 className="h-4 w-4" aria-hidden="true" />
              )}
              {shareState === "copied" ? "Link copied" : "Save link for later"}
            </button>
            {shareState === "failed" && (
              <p
                role="status"
                className="-mt-2 text-center text-xs text-zinc-400"
              >
                Couldn&apos;t copy it. The address bar has the link.
              </p>
            )}

            <div className="border-t border-zinc-800 pt-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                Meanwhile, on your phone
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {phonePicks(gameId).map((game) => (
                  <li key={game.href}>
                    <IntentLink
                      href={game.href}
                      className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-[#0d0e11] px-3 py-2 active:scale-[0.98]"
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-sm font-bold text-zinc-100 break-words">
                          {game.title}
                        </span>
                        <span className="block text-xs text-zinc-400">
                          {game.blurb}
                        </span>
                      </span>
                      <IconArrowRight
                        className="h-4 w-4 shrink-0 text-zinc-400"
                        aria-hidden="true"
                      />
                    </IntentLink>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setOverride(true)}
              className="mx-auto inline-flex min-h-[44px] items-center px-3 font-mono text-xs text-zinc-400 underline underline-offset-4 active:scale-[0.98]"
            >
              Try it anyway
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
