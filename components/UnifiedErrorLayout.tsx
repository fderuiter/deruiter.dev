/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useTelemetry } from "@/hooks/useTelemetry";
import { clamp } from "@/lib/game-utils";
import { formatNumber } from "@/lib/utils";
import { useSearch } from "@/components/providers/SearchProvider";
import dynamic from "next/dynamic";
import { RetroLabyrinthSkeleton } from "@/components/RetroLabyrinthSkeleton";

const RetroLabyrinth = dynamic(
  () => import("@/components/RetroLabyrinth").then((mod) => mod.RetroLabyrinth),
  {
    ssr: false,
    loading: () => <RetroLabyrinthSkeleton />,
  }
);
import { getClosestMatches, type CaseStudyItem } from "@/lib/search-utils";
import { logger } from "@/lib/logger";
import { resolveBaseUrl } from "@/lib/domain";

interface UnifiedErrorLayoutProps {
  badge: string;
  title: string;
  description: string;
  secondaryActionText?: string;
  secondaryActionHref?: string;
  fallbackPath?: string;
  showRetroLabyrinth?: boolean;
}

export function UnifiedErrorLayout({
  badge,
  title,
  description,
  secondaryActionText = "Back to Home",
  secondaryActionHref = "/",
  fallbackPath = "/not-found",
  showRetroLabyrinth = false,
}: UnifiedErrorLayoutProps) {
  const [mousePos, setMousePos] = useState({ x: 200, y: 200 });
  const [normalized, setNormalized] = useState({ x: 0.5, y: 0.5 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTracked = useRef(false);
  const [invalidPath, setInvalidPath] = useState<string>("");
  const [caseStudies, setCaseStudies] = useState<CaseStudyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [canonicalUrl, setCanonicalUrl] = useState<string>(
    `${resolveBaseUrl()}/`
  );
  const [isGameActivated, setIsGameActivated] = useState(false);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const handleActivateGame = () => {
    if (!isGameActivated) {
      setIsGameActivated(true);
    }
  };

  const { recordEvent } = useTelemetry();
  const { openSearch } = useSearch();

  // Capture the path and track telemetry safely on-mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname || fallbackPath;
      setCanonicalUrl(window.location.href);
      setTimeout(() => {
        setInvalidPath(currentPath);
      }, 0);

      if (!hasTracked.current) {
        hasTracked.current = true;
        recordEvent(currentPath, "route_error").catch((err) => {
          logger.error(
            `Failed to record route error telemetry for ${badge}:`,
            err
          );
        });
      }
    }
  }, [recordEvent, badge, fallbackPath]);

  // Automatically center the cursor on first mount / resize
  useEffect(() => {
    if (showRetroLabyrinth && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({ x: rect.width / 2, y: rect.height / 2 });
    }
  }, [showRetroLabyrinth]);

  // Fetch the active case studies client-side from /api/case-studies
  useEffect(() => {
    const fetchStudies = async () => {
      try {
        const res = await fetch("/api/case-studies");
        if (res.ok) {
          const data = await res.json();
          setCaseStudies(data);
        }
      } catch (err) {
        logger.error(
          "Failed to fetch case studies for recovery suggestions:",
          err
        );
      } finally {
        setLoading(false);
      }
    };
    fetchStudies();
  }, []);

  // Compute up to three closest matching case studies
  const matches = useMemo(() => {
    return getClosestMatches(invalidPath, caseStudies);
  }, [invalidPath, caseStudies]);

  const handleSuggestionClick = (slug: string) => {
    recordEvent(slug, "project_click").catch((err) => {
      logger.error("Failed to record telemetry suggestion click:", err);
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Constrain within bounds
    const boundedX = clamp(x, 0, rect.width);
    const boundedY = clamp(y, 0, rect.height);

    const normX = boundedX / rect.width;
    const normY = boundedY / rect.height;

    setMousePos({ x: boundedX, y: boundedY });
    setNormalized({ x: normX, y: normY });

    // Tilt calculations
    const maxTilt = 8; // degrees max tilt
    const tiltX = -(normY - 0.5) * maxTilt;
    const tiltY = (normX - 0.5) * maxTilt;
    setTilt({ x: tiltX, y: tiltY });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // Smoothly animate back to center
      setTilt({ x: 0, y: 0 });
      setNormalized({ x: 0.5, y: 0.5 });
      setMousePos({ x: rect.width / 2, y: rect.height / 2 });
    }
    setIsHovered(false);
  };

  return (
    <>
      <title>{`${badge} - ${title}`}</title>
      <meta name="robots" content="noindex, nofollow" />
      <link rel="canonical" href={canonicalUrl} />
      <div className="min-h-screen py-32 px-6 flex flex-col items-center justify-center bg-brand-dark text-foreground relative overflow-hidden select-none">
        {/* Background Blurs */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand-cyan/5 blur-[120px] pointer-events-none transition-all duration-700 [transform:translate(-50%,-50%)_translate(var(--blur-shift-x,0px),var(--blur-shift-y,0px))] hidden sm:block"
          style={
            showRetroLabyrinth
              ? ({
                  "--blur-shift-x": `${(normalized.x - 0.5) * 40}px`,
                  "--blur-shift-y": `${(normalized.y - 0.5) * 40}px`,
                } as React.CSSProperties)
              : undefined
          }
        />

        <div
          ref={containerRef}
          onMouseMove={showRetroLabyrinth ? handleMouseMove : undefined}
          onMouseLeave={showRetroLabyrinth ? handleMouseLeave : undefined}
          style={
            showRetroLabyrinth
              ? ({
                  "--tilt-x": `${tilt.x}deg`,
                  "--tilt-y": `${tilt.y}deg`,
                  "--tilt-transition": isHovered
                    ? "none"
                    : "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
                } as React.CSSProperties)
              : undefined
          }
          className={`relative z-10 w-full max-w-md p-8 bg-neutral-950/40 border border-neutral-900 rounded-3xl backdrop-blur-xl text-center shadow-2xl overflow-hidden [transform:perspective(1000px)_rotateX(var(--tilt-x,0deg))_rotateY(var(--tilt-y,0deg))] [transition:var(--tilt-transition,none)] ${showRetroLabyrinth ? "group" : ""}`}
        >
          {/* Spotlight overlay effect following the mouse */}
          {showRetroLabyrinth && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300 [background:radial-gradient(180px_circle_at_var(--spotlight-x)_var(--spotlight-y),rgba(6,182,212,0.08),transparent_80%)] opacity-[var(--spotlight-opacity)]"
              style={
                {
                  "--spotlight-x": `${mousePos.x}px`,
                  "--spotlight-y": `${mousePos.y}px`,
                  "--spotlight-opacity": isHovered ? 1 : 0,
                } as React.CSSProperties
              }
            />
          )}

          {/* Lightweight grid background that shifts slightly */}
          {showRetroLabyrinth && (
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern
                    id="grid-pattern"
                    width="16"
                    height="16"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 16 0 L 0 0 0 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-pattern)" />
              </svg>
            </div>
          )}

          {/* Interactive target reticle/crosshair indicator */}
          {showRetroLabyrinth && (
            <div
              className="absolute pointer-events-none mix-blend-screen transition-all duration-75"
              style={{
                left: `${mousePos.x}px`,
                top: `${mousePos.y}px`,
                transform: "translate(-50%, -50%)",
                opacity: isHovered ? 0.75 : 0.2,
              }}
            >
              {/* Target Reticle circle */}
              <div className="w-12 h-12 rounded-full border border-brand-cyan/30 flex items-center justify-center animate-spin">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
              </div>
              {/* Subtle crosshairs extending from reticle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-[1px] bg-brand-cyan/20 pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-[1px] bg-brand-cyan/20 pointer-events-none" />
            </div>
          )}

          <span className="inline-block px-3 py-1 text-xs font-mono font-bold bg-neutral-900 border border-neutral-800 text-brand-cyan rounded-md mb-6 relative">
            {badge}
          </span>

          {/* Dynamic Coordinate readout displaying interactivity in real-time */}
          {showRetroLabyrinth && (
            <div className="absolute top-4 right-4 font-mono text-[9px] text-neutral-600 space-y-0.5 text-right hidden sm:block">
              <div>LOC_X: {Math.round(mousePos.x)}px</div>
              <div>LOC_Y: {Math.round(mousePos.y)}px</div>
              <div>
                NORM: {formatNumber(normalized.x, 2)},{" "}
                {formatNumber(normalized.y, 2)}
              </div>
            </div>
          )}

          <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-white">
            {title}
          </h1>

          <p className="text-sm text-neutral-400 leading-relaxed mb-6">
            {description}
          </p>

          {/* Display Attempted Invalid URL Path */}
          {invalidPath && (
            <div className="mb-6 p-4 bg-neutral-950/80 border border-neutral-900/60 rounded-2xl text-left">
              <span className="block text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
                Requested Address
              </span>
              <div className="font-mono text-xs text-brand-cyan/90 break-all select-all font-semibold">
                {invalidPath}
              </div>
            </div>
          )}

          {/* Progressive Retro Labyrinth */}
          {showRetroLabyrinth &&
            (isGameActivated ? (
              <RetroLabyrinth isMounted={isMounted} />
            ) : (
              <div
                role="button"
                tabIndex={0}
                aria-label="Insert Coin to start Retro Labyrinth mini-game"
                data-testid="insert-coin-preview"
                onClick={handleActivateGame}
                onMouseEnter={handleActivateGame}
                onFocus={handleActivateGame}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleActivateGame();
                  }
                }}
                className="relative w-full aspect-[15/9] min-h-[240px] h-[240px] bg-neutral-950/90 border border-neutral-900 hover:border-brand-cyan/60 rounded-2xl flex flex-col items-center justify-center font-mono select-none overflow-hidden my-6 cursor-pointer group/coin transition-all duration-300 shadow-xl"
              >
                {/* Cyberpunk grid background effect */}
                <div className="absolute inset-0 pointer-events-none opacity-10 group-hover/coin:opacity-20 transition-opacity duration-300">
                  <div className="w-full h-full bg-[linear-gradient(to_right,#06b6d4_1px,transparent_1px),linear-gradient(to_bottom,#06b6d4_1px,transparent_1px)] bg-[size:16px_16px]" />
                </div>

                {/* Header Bar */}
                <div className="absolute top-3 left-4 right-4 flex justify-between items-center text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  <span>SYSTEM_LABYRINTH.EXE</span>
                  <span className="text-brand-cyan/70 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
                    IDLE_STANDBY
                  </span>
                </div>

                {/* Center Insert Coin Prompts */}
                <div className="flex flex-col items-center justify-center gap-3 p-4 z-10 text-center">
                  {/* Arcade Coin Slot Icon / Badge */}
                  <div className="w-12 h-12 rounded-full border-2 border-brand-cyan/40 group-hover/coin:border-brand-cyan group-hover/coin:scale-105 flex items-center justify-center bg-brand-cyan/10 transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                    <span className="text-brand-cyan font-extrabold text-sm tracking-tighter">
                      1¢
                    </span>
                  </div>

                  {/* Glowing Blinking INSERT COIN */}
                  <div className="space-y-1">
                    <div className="text-base sm:text-lg font-black text-brand-cyan tracking-widest animate-pulse drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]">
                      INSERT COIN
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-neutral-400 font-medium tracking-wide">
                      [ HOVER OR CLICK TO LAUNCH MINI-GAME ]
                    </p>
                  </div>
                </div>

                {/* Bottom Status Footer */}
                <div className="absolute bottom-3 left-4 right-4 text-center text-[9px] font-bold text-neutral-500 uppercase tracking-widest group-hover/coin:text-brand-cyan/80 transition-colors">
                  ▶ DEFERRED ENGINE ACTIVATION READY
                </div>
              </div>
            ))}

          {/* Closest Matching Case Study Suggestions */}
          {loading ? (
            <div className="mb-6 p-4 bg-neutral-950/40 border border-neutral-900/40 rounded-2xl flex items-center justify-center">
              <span className="animate-pulse text-xs font-mono text-neutral-500">
                Finding pages...
              </span>
            </div>
          ) : matches.length > 0 ? (
            <div className="mb-6 text-left">
              <span className="block text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest mb-3">
                Try Another Page
              </span>
              <div className="space-y-3">
                {matches.map((study) => {
                  const tagsList =
                    typeof study.tags === "string"
                      ? study.tags.split(",").map((t: string) => t.trim())
                      : Array.isArray(study.tags)
                        ? study.tags
                        : [];

                  return (
                    <Link
                      key={study.id}
                      href={`/case-studies/${study.slug}`}
                      onClick={() => handleSuggestionClick(study.slug)}
                      className="group block p-4 bg-neutral-950/60 hover:bg-neutral-900/60 border border-neutral-900 hover:border-brand-cyan/40 rounded-2xl transition-all duration-300 backdrop-blur-sm"
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h2 className="text-sm font-bold text-neutral-200 group-hover:text-brand-cyan transition-colors duration-250">
                          {study.title}
                        </h2>
                        <span className="shrink-0 px-2 py-0.5 text-[9px] font-mono font-bold bg-neutral-900 border border-neutral-800 text-brand-blue rounded">
                          {study.primary_language}
                        </span>
                      </div>
                      {tagsList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {tagsList
                            .slice(0, 3)
                            .map((tag: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-[9px] font-mono bg-neutral-900/50 border border-neutral-800/50 text-neutral-400 rounded-md"
                              >
                                {tag}
                              </span>
                            ))}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 mt-4 relative z-20">
            <button
              onClick={(e) => {
                e.currentTarget.focus();
                openSearch();
              }}
              className="inline-flex items-center justify-center w-full px-6 py-3 text-sm font-bold bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-brand-cyan/40 text-brand-cyan rounded-2xl transition-all duration-300 shadow-lg cursor-pointer"
            >
              Search Site
            </button>

            <Link
              href={secondaryActionHref}
              className="inline-flex items-center justify-center w-full px-6 py-3 text-sm font-semibold bg-transparent border border-neutral-900 hover:border-neutral-800 text-neutral-400 rounded-2xl transition-all duration-300 cursor-pointer"
            >
              {secondaryActionText}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
