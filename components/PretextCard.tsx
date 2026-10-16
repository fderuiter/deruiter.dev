"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardTitle,
  CardDescription,
  type HeadingTag,
} from "@/components/BentoGrid";
import { usePretextLayout } from "@/hooks/usePretextLayout";

interface PretextCardProps {
  title: string;
  description: string;
  className?: string;
  paddingHeight?: number; // spacing, margins, titles, and borders
  headingTag?: HeadingTag | string;
}

export const PretextCard: React.FC<PretextCardProps> = ({
  title,
  description,
  className,
  paddingHeight = 120,
  headingTag,
}) => {
  // Bind Pretext Layout observer
  const { ref, height, isReady } = usePretextLayout({
    text: description,
    fontSize: 12, // maps to CardDescription text-xs (12px)
    lineHeight: 16, // maps to standard line-height (16px)
    fontFamilyVariable: "--font-sans",
  });

  // Calculate strict heights
  const computedHeight = isReady ? height + paddingHeight : undefined;

  return (
    <Card
      className={cn(
        "min-h-[var(--pretext-card-height)] h-[var(--pretext-card-height)] transition-[height,min-height] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)]",
        className
      )}
      style={
        {
          "--pretext-card-height": computedHeight
            ? `${computedHeight}px`
            : "auto",
        } as React.CSSProperties
      }
    >
      <div className="flex flex-col h-full justify-between min-w-0">
        <div className="mb-4 min-w-0">
          <CardTitle as={headingTag}>{title}</CardTitle>
          {/* Attach Ref to the text container */}
          <div className="relative">
            {/* Custom Visual Presentation (hidden from screen readers, not selectable) */}
            <div
              ref={ref}
              aria-hidden="true"
              role="presentation"
              data-pretext-layer="visual"
              className="select-none pointer-events-none"
            >
              <CardDescription
                className={
                  !isReady ? "invisible" : "transition-opacity duration-300"
                }
              >
                {description}
              </CardDescription>
            </div>
            {/* Transparent Standard Semantic Overlay (selectable, readable by screen readers) */}
            <p
              data-pretext-layer="semantic"
              className={`font-sans text-xs font-normal leading-relaxed absolute inset-0 select-text bg-transparent ${!isReady ? "invisible" : "transition-opacity duration-300"}`}
            >
              {description}
            </p>
          </div>
        </div>
        <div className="text-[10px] text-accent font-mono self-end opacity-60">
          {!isReady ? "Measuring..." : `Pretext height: ${computedHeight}px`}
        </div>
      </div>
    </Card>
  );
};
