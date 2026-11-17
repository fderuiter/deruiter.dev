"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> {
  /**
   * Accessible name describing the button action (required by WCAG 4.1.2 and SC 2.5.8).
   * Must be a non-empty string.
   */
  "aria-label": string;
  /**
   * Optional icon to render inside the button. If omitted, `children` is rendered.
   */
  icon?: React.ReactNode;
  /**
   * Whether to apply the pseudo-element target expansion pattern (`after:absolute after:-inset-1.5`)
   * per WCAG Technique C42 for dense layouts with 12px or 14px icons. Defaults to true.
   */
  expandTarget?: boolean;
}

/**
 * Standardized compact icon button component enforcing minimum target size
 * of 24 by 24 CSS pixels per WCAG 2.2 SC 2.5.8 and WCAG Technique C42,
 * with touch target expansion to 44 by 44 CSS pixels on coarse pointer devices.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      "aria-label": ariaLabel,
      icon,
      expandTarget = true,
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        className={cn(
          "relative inline-flex items-center justify-center shrink-0 min-w-6 min-h-6 pointer-coarse:min-h-11 pointer-coarse:min-w-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan transition-colors",
          expandTarget && "after:content-[''] after:absolute after:-inset-1.5",
          className
        )}
        {...props}
      >
        {icon ?? children}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
