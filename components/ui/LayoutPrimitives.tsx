"use client";

import React, { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ModalContainer, ModalContainerProps } from "./ModalContainer";

interface DefensiveFlexProps extends HTMLAttributes<HTMLElement> {
  /**
   * Underlying HTML element tag or custom component. Defaults to "div".
   * Narrowed to elements that take HTML attributes, so the React Three Fiber
   * scene elements (#1813) never join the union.
   */
  as?: ElementType<HTMLAttributes<HTMLElement>>;
  /**
   * Flex direction layout. Defaults to "row".
   */
  direction?: "row" | "col" | "row-reverse" | "col-reverse";
  /**
   * Alignment along cross axis (align-items).
   */
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  /**
   * Alignment along main axis (justify-content).
   */
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  /**
   * Flex wrap rule. Defaults to "nowrap".
   */
  wrap?: "wrap" | "nowrap" | "wrap-reverse";
  /**
   * Gap spacing between flex children (e.g. "gap-2" or "2").
   */
  gap?: string;
  /**
   * Enables container queries (@container) on the flex wrapper.
   */
  useContainerQuery?: boolean;
  children: ReactNode;
  className?: string;
}

const alignClasses: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const justifyClasses: Record<string, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
};

const directionClasses: Record<string, string> = {
  row: "flex-row",
  col: "flex-col",
  "row-reverse": "flex-row-reverse",
  "col-reverse": "flex-col-reverse",
};

const wrapClasses: Record<string, string> = {
  wrap: "flex-wrap",
  nowrap: "flex-nowrap",
  "wrap-reverse": "flex-wrap-reverse",
};

/**
 * DefensiveFlex: A shared defensive flex container primitive enforcing min-w-0 max-w-full overflow-hidden rules
 * to defend against horizontal flex overflow and layout blowouts across viewports.
 */
export function DefensiveFlex({
  as: Component = "div",
  direction = "row",
  align,
  justify,
  wrap = "nowrap",
  gap,
  useContainerQuery = false,
  children,
  className = "",
  ...props
}: DefensiveFlexProps) {
  const gapClass = gap ? (gap.startsWith("gap-") ? gap : `gap-${gap}`) : "";

  return (
    <Component
      className={cn(
        "flex min-w-0 max-w-full overflow-hidden",
        directionClasses[direction] || "flex-row",
        align && alignClasses[align],
        justify && justifyClasses[justify],
        wrap && wrapClasses[wrap],
        gapClass,
        useContainerQuery && "@container",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

interface TruncatedTextProps extends HTMLAttributes<HTMLElement> {
  /**
   * Underlying HTML element tag or custom component. Defaults to "span".
   */
  as?: ElementType<HTMLAttributes<HTMLElement>>;
  /**
   * Clamp mode: true or 1 for single-line truncate, or a number > 1 for line-clamp.
   */
  clamp?: boolean | number;
  /**
   * Whether to break long word tokens (break-words text-token-break).
   */
  breakWords?: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
}

/**
 * TruncatedText: Text wrapper applying defensive text truncation (min-w-0 truncate or line-clamp)
 * or break-words rules to prevent text-driven layout clipping or parent container blowouts.
 */
export function TruncatedText({
  as: Component = "span",
  clamp = true,
  breakWords = false,
  children,
  className = "",
  title,
  ...props
}: TruncatedTextProps) {
  const isLineClamp = typeof clamp === "number" && clamp > 1;
  const isSingleLineTruncate = clamp === true || clamp === 1;

  const clampClass = isLineClamp
    ? `line-clamp-${clamp} min-w-0`
    : isSingleLineTruncate
      ? "min-w-0 truncate block"
      : "min-w-0";

  const breakClass = breakWords ? "break-words text-token-break" : "";

  return (
    <Component
      className={cn(clampClass, breakClass, className)}
      title={title}
      {...props}
    >
      {children}
    </Component>
  );
}

export { ModalContainer };
export type { ModalContainerProps };
