"use client";

import React, { useRef } from "react";
import { hexToRgba, cn } from "@/lib/utils";
import { motion, useScroll, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { designManifest } from "@/lib/design-manifest";

interface TracingBeamProps {
  children: React.ReactNode;
  className?: string;
}

export const TracingBeam: React.FC<TracingBeamProps> = ({ children, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // 1. Track scroll progress of the container relative to the viewport
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // 2. Smooth the scroll progress with spring physics
  const scrollYProgressSpring = useSpring(scrollYProgress, {
    stiffness: designManifest.motion.springs.smooth.stiffness,
    damping: 22,
    restDelta: 0.001,
  });

  // Active motion progress value adhering to reduced motion settings
  const activeProgress = shouldReduceMotion ? scrollYProgress : scrollYProgressSpring;

  // Map progress to percentage translation for the marker indicator (0% to 100%)
  const yTransform = useTransform(activeProgress, [0, 1], ["0%", "100%"]);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full max-w-4xl mx-auto", className)}
    >
      {/* 4. Scroll-Linked Tracing Beam Left-Margin Rail */}
      <div className="absolute -left-6 md:-left-12 lg:-left-16 top-4 bottom-4 w-[2px] bg-zinc-900/60 rounded-full hidden md:block select-none pointer-events-none">
        {/* Active glowing beam segment scaled via composited GPU transform */}
        <motion.div
          style={{
            scaleY: activeProgress,
            originY: 0,
            "--beam-glow": `0 0 8px ${hexToRgba(designManifest.colors["brand-cyan"], 0.3)}`
          } as /* eslint-disable-line @typescript-eslint/no-explicit-any */ any}
          className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-brand-cyan via-brand-blue to-purple-500 rounded-full shadow-[var(--beam-glow)] origin-top transform-gpu will-change-transform"
        />
        
        {/* Breathing Head floating focus bubble translated via composited GPU transform */}
        <motion.div
          style={{
            y: yTransform,
            "--dot-glow": `0 0 15px ${hexToRgba(designManifest.colors["brand-cyan"], 0.8)}`
          } as /* eslint-disable-line @typescript-eslint/no-explicit-any */ any}
          className="absolute top-0 left-0 w-full h-full transform-gpu will-change-transform pointer-events-none"
        >
          <div className="absolute top-0 -left-[5px] -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-brand-cyan border-2 border-zinc-950 shadow-[var(--dot-glow)] flex items-center justify-center">
            {/* Neon pulsating ring */}
            {!shouldReduceMotion && (
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping absolute opacity-75" />
            )}
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </motion.div>
      </div>

      {/* 5. Main content viewport shifted on desktop to leave rail space */}
      <div className="w-full md:pl-8 lg:pl-12">
        {children}
      </div>
    </div>
  );
};
