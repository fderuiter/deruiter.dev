"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  IconBone,
  IconHeart,
  IconSparkles,
  IconChevronRight,
  IconChevronLeft,
} from "@tabler/icons-react";
import { getPhotosByCategory } from "@/lib/media-registry";

const CAROUSEL_NAV_BUTTON_BASE =
  "absolute z-10 top-1/2 -translate-y-1/2 min-w-11 min-h-11 rounded-full bg-black/70 border border-white/25 flex items-center justify-center text-white hover:bg-amber-400 hover:text-black active:scale-[0.98] transition-colors backdrop-blur-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export const BioSpotlight: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const duckPhotos = getPhotosByCategory("duck");
  const bioPhotos = getPhotosByCategory("bio");

  // Growth journey highlights
  const journey = [
    duckPhotos.find((p) => p.id === "duck-puppy-headrest")!,
    duckPhotos.find((p) => p.id === "duck-puppy-bed")!,
    duckPhotos.find((p) => p.id === "duck-puppy-mirror")!,
    bioPhotos.find((p) => p.id === "fred-duck-yellow-shirt")!,
    bioPhotos.find((p) => p.id === "fred-duck-shoulder")!,
    duckPhotos.find((p) => p.id === "fred-duck-carried-doorway")!,
  ].filter(Boolean);

  const [activeIndex, setActiveIndex] = useState(0);
  const activePhoto = journey[activeIndex];

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % journey.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + journey.length) % journey.length);
  };

  return (
    <section
      data-testid="bio-spotlight"
      aria-labelledby="duck-bio-spotlight-title"
      className="@container w-full max-w-4xl min-w-0 mx-auto"
    >
      <div className="relative isolate rounded-3xl bg-[#13151a] border border-white/10 p-3 sm:p-5 @2xl:p-8 shadow-2xl overflow-hidden">
        <div className="grid grid-cols-1 @2xl:grid-cols-12 gap-5 sm:gap-6 @2xl:gap-8 items-center">
          {/* Left Column: Image with interactive controls */}
          <div className="@2xl:col-span-5 min-w-0 flex flex-col items-center">
            <div className="relative w-full max-w-[280px] sm:max-w-[320px] @2xl:max-w-none aspect-[3/4] min-w-0 rounded-2xl overflow-hidden border border-white/15 shadow-xl bg-black/60">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePhoto.id}
                  initial={
                    shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }
                  }
                  animate={
                    shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }
                  }
                  exit={
                    shouldReduceMotion ? undefined : { opacity: 0, scale: 1.04 }
                  }
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.25,
                    ease: "easeInOut",
                  }}
                  className="relative w-full h-full"
                >
                  <Image
                    src={activePhoto.src}
                    alt={activePhoto.alt}
                    fill
                    sizes="(min-width: 672px) 320px, (max-width: 639px) calc(100vw - 56px), 280px"
                    className="object-cover"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-3 left-3 right-3 text-left">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-400 text-black mb-1">
                      Stage {activeIndex + 1} of {journey.length}
                    </span>
                    <p className="text-xs font-mono font-semibold text-white truncate">
                      {activePhoto.title}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Quick Navigation Overlays */}
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous co-pilot milestone photo"
                className={`${CAROUSEL_NAV_BUTTON_BASE} left-3`}
              >
                <IconChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next co-pilot milestone photo"
                className={`${CAROUSEL_NAV_BUTTON_BASE} right-3`}
              >
                <IconChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Thumbnail Dot Strip */}
            <div
              className="flex items-center justify-center mt-1"
              role="group"
              aria-label="Photo growth milestones"
            >
              {journey.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={idx === activeIndex}
                  aria-label={`Jump to milestone ${idx + 1}: ${p.title}`}
                  onClick={() => setActiveIndex(idx)}
                  className="group min-w-11 min-h-11 inline-flex items-center justify-center rounded-full cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#13151a]"
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 rounded-full transition-[width,background-color] duration-200 ${
                      idx === activeIndex
                        ? "w-6 bg-amber-400"
                        : "w-2 bg-white/20 group-hover:bg-white/40"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Bio & Co-Pilot Narrative */}
          <div className="@2xl:col-span-7 min-w-0 flex flex-col justify-center text-left">
            <div className="inline-flex min-w-0 max-w-full items-center gap-2 px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-[11px] font-mono font-medium mb-3 w-fit">
              <IconBone className="w-3.5 h-3.5 text-amber-400" />
              <span className="min-w-0 break-words">
                Canine Co-Pilot &amp; Pair Programmer
              </span>
            </div>

            <h2
              id="duck-bio-spotlight-title"
              className="type-heading min-w-0 break-words text-white mb-2"
            >
              Meet Duck: From 8-Week Fluff to 80-lb Marshmallow
            </h2>

            <p className="min-w-0 text-xs sm:text-sm text-zinc-300 leading-relaxed mb-4">
              Behind the code, clinical derivations, and side projects is Duck,
              an English Cream Golden Retriever who started as a pillow-sized
              puppy asleep across Fred&apos;s head and grew into an 80-lb pair
              programmer.
            </p>

            {/* Active Milestone Callout Box */}
            <div
              aria-live="polite"
              aria-atomic="true"
              className="min-w-0 p-3.5 rounded-xl bg-black/40 border border-white/10 mb-4"
            >
              <div className="flex min-w-0 items-center gap-2 text-xs font-mono font-bold text-amber-300 mb-1">
                <IconSparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="min-w-0 break-words">{activePhoto.title}</span>
              </div>
              <p className="break-words text-xs text-zinc-300 leading-relaxed font-sans">
                {activePhoto.caption}
              </p>
            </div>

            <div className="min-w-0 flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-400">
              <span className="flex min-w-0 items-center gap-1">
                <IconHeart className="w-3.5 h-3.5 text-rose-400" />
                <span className="min-w-0 break-words">
                  Treat Approval Rate: 100%
                </span>
              </span>
              <span className="min-w-0 text-zinc-600">•</span>
              <span className="min-w-0 break-words">
                Merge Conflict Shield: Active
              </span>
              <span className="min-w-0 text-zinc-600">•</span>
              <span className="min-w-0 break-words text-amber-300">
                Duck Fact #{activeIndex + 1}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
