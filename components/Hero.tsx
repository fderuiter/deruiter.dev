"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePretextLayout } from "@/hooks/usePretextLayout";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AnimatedGridPattern } from "@/components/AnimatedGridPattern";
import { designManifest } from "@/lib/design-manifest";
import { BioSpotlight } from "@/components/BioSpotlight";
import {
  IconDeviceGamepad2,
  IconArrowRight,
  IconBrandGithub,
} from "@tabler/icons-react";

interface HeroHeadlineProps {
  text: string;
}

/* jscpd:ignore-start */
export const HeroHeadline: React.FC<HeroHeadlineProps> = ({ text }) => {
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { ref, height, isReady } = usePretextLayout({
    text,
    fontSize: 54,
    lineHeight: 60,
    fontFamilyVariable: "--font-heading",
    getResponsiveMetrics: (width) => {
      if (width < 450) {
        return { fontSize: 32, lineHeight: 36 };
      } else if (width < 768) {
        return { fontSize: 40, lineHeight: 46 };
      }
      return { fontSize: 54, lineHeight: 60 };
    },
  });

  const words = text.split(" ");

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0.02 : 0.04,
      },
    },
  };

  // Transform-only entrance (#817). The words must never start at opacity 0:
  // Chromium and WebKit skip fully transparent text when scoring LCP
  // candidacy, so a fade-in swaps the already-painted static fallback for an
  // invisible layer and pushes the recorded LCP out to wherever the animation
  // settles. Translating and scaling from an opaque start keeps every frame a
  // valid paint candidate, runs on the compositor, and preserves the staggered
  // spring entrance.
  const wordVariants = {
    hidden: { y: 14, scale: 0.97 },
    visible: {
      y: 0,
      scale: 1,
      transition: { ...designManifest.motion.springs.hero, mass: 0.35 },
    },
  };

  return (
    <div
      style={{ minHeight: isReady && height ? `${height}px` : undefined }}
      className="relative w-full max-w-4xl mx-auto lg:mx-0 min-h-[72px] sm:min-h-[90px] lg:min-h-[110px] mb-4 sm:mb-6 transition-[min-height] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
    >
      <h1
        ref={ref}
        data-pretext-layer="heading"
        className="fluid-heading-hero font-extrabold tracking-tight text-center lg:text-left text-white leading-tight heading-editorial w-full select-text"
      >
        {!isReady || isMobile ? (
          text
        ) : (
          <>
            {/* aria-label is prohibited on a paragraph and unreliable on
                a heading, so screen readers get a visually hidden copy. */}
            <span className="sr-only">{text}</span>
            <motion.span
              aria-hidden="true"
              variants={containerVariants}
              initial={shouldReduceMotion ? false : "hidden"}
              animate="visible"
              className="flex flex-wrap justify-center lg:justify-start"
            >
              {words.map((word, i) => (
                <React.Fragment key={i}>
                  <motion.span
                    aria-hidden="true"
                    variants={wordVariants}
                    className="inline-block mr-[0.22em] will-change-transform text-white font-extrabold"
                  >
                    {word}
                  </motion.span>
                  {i < words.length - 1 ? " " : null}
                </React.Fragment>
              ))}
            </motion.span>
          </>
        )}
      </h1>
    </div>
  );
/* jscpd:ignore-end */
};

interface HeroTextProps {
  text: string;
}

/* jscpd:ignore-start */
export const HeroText: React.FC<HeroTextProps> = ({ text }) => {
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { ref, height, isReady } = usePretextLayout({
    text,
    fontSize: 16,
    lineHeight: 28,
    fontFamilyVariable: "--font-sans",
    getResponsiveMetrics: (width) => {
      if (width < 640) {
        return { fontSize: 14, lineHeight: 22 };
      }
      return { fontSize: 16, lineHeight: 26 };
    },
  });

  const words = text.split(" ");

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0.01 : 0.015,
        delayChildren: shouldReduceMotion ? 0.1 : 0.3,
      },
    },
  };

  // Transform-only entrance (#817), matching HeroHeadline. The hero intro sits
  // directly beneath the headline and is a plausible LCP candidate in its own
  // right at narrow widths, so it must not start transparent either.
  const wordVariants = {
    hidden: { y: 8, scale: 0.98 },
    visible: {
      y: 0,
      scale: 1,
      transition: { ...designManifest.motion.springs.heroBeam, mass: 0.25 },
    },
  };

  return (
    <div
      style={{ minHeight: isReady && height ? `${height}px` : undefined }}
      className="relative w-full max-w-2xl mx-auto lg:mx-0 min-h-[48px] sm:min-h-[54px] mb-6 sm:mb-8 transition-[min-height] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
    >
      <p
        ref={ref}
        data-pretext-layer="body"
        className="text-zinc-300 fluid-body leading-relaxed text-center lg:text-left w-full select-text"
      >
        {!isReady || isMobile ? (
          text
        ) : (
          <>
            {/* aria-label is prohibited on a paragraph and unreliable on
                a heading, so screen readers get a visually hidden copy. */}
            <span className="sr-only">{text}</span>
            <motion.span
              aria-hidden="true"
              variants={containerVariants}
              initial={shouldReduceMotion ? false : "hidden"}
              animate="visible"
              className="flex flex-wrap justify-center lg:justify-start"
            >
              {words.map((word, i) => (
                <React.Fragment key={i}>
                  <motion.span
                    aria-hidden="true"
                    variants={wordVariants}
                    className="inline-block mr-[0.3em] will-change-transform"
                  >
                    {word}
                  </motion.span>
                  {i < words.length - 1 ? " " : null}
                </React.Fragment>
              ))}
            </motion.span>
          </>
        )}
      </p>
    </div>
  );
/* jscpd:ignore-end */
};

interface HeroProps {
  className?: string;
}

export const Hero: React.FC<HeroProps> = ({ className }) => {
  const shouldReduceMotion = useReducedMotion();
  const headline = "Hi, I’m Fred. I make complicated things usable.";
  const introText =
    "My background is in clinical research. I build software for the fiddly parts: messy data, complicated forms, and rules that need to hold up. I also made a loon shoot lasers. There’s room for both.";

  return (
    <section
      id="hero"
      className={cn(
        "section-isolate relative min-h-[90dvh] lg:min-h-[90dvh] w-full flex flex-col justify-center items-center overflow-hidden bg-[#0d0e11] px-4 sm:px-6 md:px-8 lg:px-12 pt-32 pb-16 sm:pt-36 lg:pt-44 lg:pb-24",
        className
      )}
    >
      {/* 1. Precision Grid Background with Radial Mask */}
      <div className="absolute inset-0 z-0 opacity-25 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_45%,#000_65%,transparent_100%)] pointer-events-none">
        <AnimatedGridPattern
          numSquares={35}
          maxOpacity={0.12}
          duration={5}
          repeatDelay={1}
          className="fill-amber-500/15 stroke-white/10"
        />
      </div>

      {/* 2. Architectural Blueprint Corner Cues (desktop) */}
      <div className="hidden lg:flex absolute top-28 left-12 items-center gap-2 text-[10px] font-mono text-zinc-600 select-none">
        <span className="text-amber-500/60">[+]</span>
        <span>CLINICAL DATA / SOFTWARE / SIDE QUESTS</span>
      </div>
      <div className="hidden lg:flex absolute top-28 right-12 items-center gap-2 text-[10px] font-mono text-zinc-600 select-none">
        <span>LOC: Minneapolis</span>
        <span className="text-amber-500/60">[+]</span>
      </div>

      {/* 3. Hero Split Grid Container */}
      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10 lg:gap-12 items-center">
        {/* Left Column: Editorial Statement & Actions */}
        <div className="lg:col-span-7 min-w-0 flex flex-col items-center lg:items-start text-center lg:text-left">
          {/* Micro Brand Identifier */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.5, ease: "easeOut" }
            }
            className="inline-flex items-center gap-2 px-3 py-1 mb-5 sm:mb-6 text-[10px] sm:text-xs font-mono font-semibold tracking-[0.15em] uppercase text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-full"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>FREDERICK DE RUITER / SOFTWARE &amp; SYSTEMS</span>
          </motion.div>

          {/* Dynamic Staggered Pretext-powered Title */}
          <HeroHeadline text={headline} />

          {/* Dynamic Pretext-powered Description */}
          <HeroText text={introText} />

          {/* CTA Action Group */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    delay: 0.5,
                    duration: 0.6,
                    ...designManifest.motion.springs.smooth,
                  }
            }
            className="w-full flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 mt-2"
          >
            {/* Primary Action */}
            <a
              href="#case-studies"
              className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-7 py-3.5 text-xs sm:text-sm font-mono font-bold text-black bg-amber-400 hover:bg-amber-300 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0e11]"
            >
              <span>Explore My Work</span>
              <IconArrowRight className="w-4 h-4" />
            </a>

            {/* Secondary Actions */}
            <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto sm:flex sm:flex-row sm:gap-3">
              <Link
                href="/arcade"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 text-xs font-mono font-semibold text-zinc-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-200 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0e11]"
              >
                <IconDeviceGamepad2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">Arcade &amp; Labs</span>
              </Link>
              <a
                href="https://github.com/fderuiter"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 text-xs font-mono font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-200 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0e11]"
              >
                <IconBrandGithub className="w-4 h-4 shrink-0" />
                <span className="truncate">GitHub</span>
              </a>
            </div>
          </motion.div>

          {/* Micro Invariant Telemetry Badges */}
          <div className="mt-8 pt-6 border-t border-white/5 w-full flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-[10px] font-mono text-zinc-400 select-none">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>CLINICAL OPERATIONS EXPERIENCE</span>
            </span>
            <Link
              href="/case-studies/designing-for-my-brother"
              className="flex items-center gap-1.5 hover:text-amber-300 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>ACCESSIBILITY: FOR MY BROTHER ↗</span>
            </Link>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>SOURCE ON GITHUB</span>
            </span>
          </div>
        </div>

        {/* Right Column: Duck's Co-Pilot Spotlight */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  delay: 0.4,
                  duration: 0.7,
                  ...designManifest.motion.springs.smooth,
                }
          }
          className="lg:col-span-5 min-w-0 w-full"
        >
          <BioSpotlight />
        </motion.div>
      </div>
    </section>
  );
};
