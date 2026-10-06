// Source: https://ui.aceternity.com/components/bento-grid
// Source: https://ui.aceternity.com/components/glare-card
"use client";
import { cn } from "@/lib/utils";
import React, { useRef, useEffect } from "react";
import { clamp } from "@/lib/game-utils";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-3 items-start",
        className
      )}
    >
      {children}
    </div>
  );
};

export const Card = ({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const isPointerInside = useRef(false);
  const refElement = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafId = useRef<number | null>(null);
  const state = useRef({
    glare: { x: 50, y: 50 },
    background: { x: 50, y: 50 },
    rotate: { x: 0, y: 0 },
  });

  const updateRect = () => {
    if (refElement.current) {
      rectRef.current = refElement.current.getBoundingClientRect();
    }
  };

  useEffect(() => {
    const handleResize = () => {
      rectRef.current = null;
    };

    window.addEventListener("resize", handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && refElement.current) {
      resizeObserver = new ResizeObserver(() => {
        rectRef.current = null;
      });
      resizeObserver.observe(refElement.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, []);

  const containerStyle = {
    "--m-x": "50%",
    "--m-y": "50%",
    "--r-x": "0deg",
    "--r-y": "0deg",
    "--bg-x": "50%",
    "--bg-y": "50%",
    "--duration": "300ms",
    "--foil-size": "100%",
    "--opacity": "0",
    "--radius": "24px",
    "--easing": "ease",
    "--transition": "var(--duration) var(--easing)",
    ...style,
  } as React.CSSProperties;

  const backgroundStyle = {
    "--step": "5%",
    "--foil-svg": `url("data:image/svg+xml,%3Csvg width='26' height='26' viewBox='0 0 26 26' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2.99994 3.419C2.99994 3.419 21.6142 7.43646 22.7921 12.153C23.97 16.8695 3.41838 23.0306 3.41838 23.0306' stroke='white' stroke-width='5' stroke-miterlimit='3.86874' stroke-linecap='round' style='mix-blend-mode:darken'/%3E%3C/svg%3E")`,
    "--pattern": "var(--foil-svg) center/100% no-repeat",
    "--rainbow":
      "repeating-linear-gradient( 0deg,rgb(255,119,115) calc(var(--step) * 1),rgba(255,237,95,1) calc(var(--step) * 2),rgba(168,255,95,1) calc(var(--step) * 3),rgba(131,255,247,1) calc(var(--step) * 4),rgba(120,148,255,1) calc(var(--step) * 5),rgb(216,117,255) calc(var(--step) * 6),rgb(255,119,115) calc(var(--step) * 7) ) 0% var(--bg-y)/200% 700% no-repeat",
    "--diagonal":
      "repeating-linear-gradient( 128deg,#0e152e 0%,hsl(180,10%,60%) 3.8%,hsl(180,10%,60%) 4.5%,hsl(180,10%,60%) 5.2%,#0e152e 10%,#0e152e 12% ) var(--bg-x) var(--bg-y)/300% no-repeat",
    "--shade":
      "radial-gradient( farthest-corner circle at var(--m-x) var(--m-y),rgba(255,255,255,0.1) 12%,rgba(255,255,255,0.15) 20%,rgba(255,255,255,0.25) 120% ) var(--bg-x) var(--bg-y)/300% no-repeat",
    "--bg-blend-mode": "hue, hue, hue, overlay",
  } as React.CSSProperties;

  const updateStyles = () => {
    if (refElement.current) {
      const { background, rotate, glare } = state.current;
      refElement.current.style.setProperty("--m-x", `${glare.x}%`);
      refElement.current.style.setProperty("--m-y", `${glare.y}%`);
      refElement.current.style.setProperty("--r-x", `${rotate.x}deg`);
      refElement.current.style.setProperty("--r-y", `${rotate.y}deg`);
      refElement.current.style.setProperty("--bg-x", `${background.x}%`);
      refElement.current.style.setProperty("--bg-y", `${background.y}%`);
    }
  };

  return (
    <div
      style={containerStyle}
      className={cn(
        "@container relative isolate w-full h-full transition-transform delay-[var(--delay)] duration-[var(--duration)] ease-[var(--easing)] will-change-transform [contain:layout_style] [perspective:600px]",
        className
      )}
      ref={refElement}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        if (getMatchMediaMatches("(prefers-reduced-motion: reduce)")) return;

        if (!rectRef.current && refElement.current) {
          rectRef.current = refElement.current.getBoundingClientRect();
        }
        const rect = rectRef.current;
        if (!rect || rect.width === 0 || rect.height === 0) return;

        const rotateFactor = 0.35;
        const position = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const percentage = {
          x: (100 / rect.width) * position.x,
          y: (100 / rect.height) * position.y,
        };
        const delta = {
          x: percentage.x - 50,
          y: percentage.y - 50,
        };

        const { background, rotate, glare } = state.current;
        background.x = 50 + percentage.x / 4 - 12.5;
        background.y = 50 + percentage.y / 3 - 16.67;
        rotate.x = -(delta.x / 3.5);
        rotate.x = clamp(rotate.x, -rotateFactor * 35, rotateFactor * 35);
        rotate.y = delta.y / 2;
        rotate.y = clamp(rotate.y, -rotateFactor * 35, rotateFactor * 35);
        glare.x = percentage.x;
        glare.y = percentage.y;

        if (rafId.current === null) {
          rafId.current = requestAnimationFrame(() => {
            updateStyles();
            rafId.current = null;
          });
        }
      }}
      onPointerEnter={() => {
        isPointerInside.current = true;
        updateRect();
        if (refElement.current) {
          setTimeout(() => {
            if (isPointerInside.current) {
              refElement.current?.style.setProperty("--duration", "0s");
            }
          }, 300);
        }
      }}
      onPointerLeave={() => {
        isPointerInside.current = false;
        if (rafId.current !== null) {
          cancelAnimationFrame(rafId.current);
          rafId.current = null;
        }
        if (refElement.current) {
          refElement.current.style.removeProperty("--duration");
          refElement.current.style.setProperty("--r-x", `0deg`);
          refElement.current.style.setProperty("--r-y", `0deg`);
        }
      }}
    >
      <div className="h-full grid [grid-template-areas:'stack'] transform-gpu [transform-style:preserve-3d] rounded-[var(--radius)]">
        {/* Layer 1: Solid Dark Background & Subtle Border */}
        <div className="border border-zinc-800/80 [grid-area:1/1] rounded-[var(--radius)] bg-zinc-950/70 backdrop-blur-md" />

        {/* Layer 2: Dynamic Holographic Glare Pattern */}
        <div
          className="will-change-background after:grid-area-[inherit] after:bg-repeat-[inherit] after:bg-attachment-[inherit] after:bg-origin-[inherit] after:bg-clip-[inherit] relative grid h-full w-full opacity-[var(--opacity)] [background-blend-mode:hue_hue_hue_overlay] mix-blend-color-dodge transition-opacity [background:var(--pattern),_var(--rainbow),_var(--diagonal),_var(--shade)] [clip-path:inset(0_0_1px_0_round_var(--radius))] [grid-area:1/1] after:bg-[inherit] after:[background-size:var(--foil-size),_200%_400%,_800%,_200%] after:[background-position:center,_0%_var(--bg-y),_calc(var(--bg-x)*_-1)_calc(var(--bg-y)*_-1),_var(--bg-x)_var(--bg-y)] after:[background-blend-mode:soft-light,_hue,_hard-light] after:mix-blend-exclusion after:content-[''] pointer-events-none"
          style={backgroundStyle}
        />

        {/* Layer 3: High-Contrast Foreground Content (never degraded by blend modes or glare) */}
        <div className="relative z-10 [grid-area:1/1] h-full w-full flex flex-col min-w-0">
          <div
            className={cn(
              "h-full w-full p-5 flex flex-col justify-between flex-1 min-w-0",
              className
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export const CardTitle = ({
  className,
  children,
  as = "h3",
  style,
}: {
  className?: string;
  children: React.ReactNode;
  as?: HeadingTag | string;
  style?: React.CSSProperties;
}) => {
  const validTags = ["h1", "h2", "h3", "h4", "h5", "h6"];
  const resolvedTag =
    as && typeof as === "string" && validTags.includes(as.toLowerCase())
      ? as.toLowerCase()
      : "h3";
  const Component = resolvedTag as React.ElementType<
    React.HTMLAttributes<HTMLElement>
  >;

  return (
    <Component
      className={cn(
        "my-2 font-heading font-bold text-neutral-100 group-hover:text-brand-cyan transition-colors duration-300 break-words text-balance min-w-0",
        className
      )}
      style={style}
    >
      {children}
    </Component>
  );
};

export const CardDescription = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "font-sans text-xs font-normal text-muted-strong leading-relaxed break-words min-w-0",
        className
      )}
    >
      {children}
    </div>
  );
};
