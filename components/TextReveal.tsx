// Source: https://magicui.design/docs/components/text-reveal
"use client";

import {
  Fragment,
  useRef,
  type ComponentPropsWithoutRef,
  type FC,
  type ReactNode,
} from "react";
import { motion, MotionValue, useScroll, useTransform } from "framer-motion";

import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface TextRevealProps extends ComponentPropsWithoutRef<"div"> {
  children: string;
}

export const TextReveal: FC<TextRevealProps> = ({ children, className }) => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  // Hydration-safe: the server and the first client render both take the
  // static branch, so the per-word markup only mounts after hydration (#2893).
  const shouldReduceMotion = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 85%", "start 25%"],
  });

  if (typeof children !== "string") {
    throw new Error("TextReveal: children must be a string");
  }

  const words = children.split(" ");

  if (shouldReduceMotion) {
    return (
      <div
        ref={sectionRef}
        className={cn("relative z-0 py-16 sm:py-20 md:py-24", className)}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-center bg-transparent px-4 sm:px-6">
          <p className="flex flex-wrap justify-center text-center p-3 sm:p-5 text-xl sm:text-2xl font-bold text-white md:p-8 md:text-3xl lg:p-10 lg:text-4xl xl:text-5xl leading-relaxed">
            {children}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={sectionRef}
      className={cn("relative z-0 py-16 sm:py-20 md:py-24", className)}
    >
      <div className="mx-auto flex max-w-4xl items-center justify-center bg-transparent px-4 sm:px-6">
        <p
          className={
            "flex flex-wrap justify-center text-center p-3 sm:p-5 text-xl sm:text-2xl font-bold text-zinc-400 md:p-8 md:text-3xl lg:p-10 lg:text-4xl xl:text-5xl leading-relaxed"
          }
        >
          {words.map((word, i) => {
            const start = i / words.length;
            const end = start + 1 / words.length;
            return (
              <Fragment key={i}>
                <Word progress={scrollYProgress} range={[start, end]}>
                  {word}
                </Word>{" "}
              </Fragment>
            );
          })}
        </p>
      </div>
    </div>
  );
};

interface WordProps {
  children: ReactNode;
  progress: MotionValue<number>;
  range: [number, number];
}

const Word: FC<WordProps> = ({ children, progress, range }) => {
  const color = useTransform(progress, range, ["#a1a1aa", "#ffffff"]);
  return (
    <span className="relative mx-1 lg:mx-1.5">
      <motion.span style={{ color }}>{children}</motion.span>
    </span>
  );
};
