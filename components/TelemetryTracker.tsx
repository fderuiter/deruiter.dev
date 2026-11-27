"use client";

import React, { useEffect, useRef } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";

interface TelemetryTrackerProps {
  slug: string;
}

/**
 * Lightweight Client Component tracker designed to silently capture page_view events during browser idle frames.
 * Bypasses SSR restrictions on server pages without compromising SEO rankings or speed metrics.
 */
export const TelemetryTracker: React.FC<TelemetryTrackerProps> = ({ slug }) => {
  const { recordEvent } = useTelemetry();
  const hasTracked = useRef(false);

  useEffect(() => {
    // Avoid double-tracking views in React 19/18 strict mode double-renders
    if (hasTracked.current) return;
    hasTracked.current = true;

    recordEvent(slug, "page_view", { defer: true });
  }, [slug, recordEvent]);

  return null;
};
