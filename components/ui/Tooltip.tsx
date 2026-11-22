"use client";
import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clamp } from "@/lib/utils";

const noopSubscribe = () => () => {};

// Anchor positioning and the Popover API together put the tip in the top
// layer, tethered to its trigger and flipped at the viewport edge (#3978).
// Read after hydration only, so the server and first client render agree.
const supportsAnchoredPopover = () =>
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("anchor-name: --a") &&
  typeof HTMLElement !== "undefined" &&
  typeof HTMLElement.prototype.showPopover === "function";

// Time to cross the gap between trigger and tip without it closing, so the
// tip stays hoverable (WCAG 1.4.13).
const HIDE_DELAY_MS = 120;

const TIP_CLASSES =
  "w-max max-w-xs p-2 text-xs font-sans not-italic font-normal normal-case text-left tracking-normal text-neutral-200 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg pointer-events-auto";

// Shared show/hide state for both tooltip forms. The popover mirrors the
// state, and the browser's light dismiss (Escape, another popover) closes it.
function useHint(native: boolean) {
  const [show, setShow] = useState(false);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  const open = useCallback(() => {
    cancelHide();
    setShow(true);
  }, [cancelHide]);

  const close = useCallback(() => {
    cancelHide();
    setShow(false);
  }, [cancelHide]);

  const closeSoon = useCallback(() => {
    cancelHide();
    hideTimerRef.current = setTimeout(() => setShow(false), HIDE_DELAY_MS);
  }, [cancelHide]);

  useEffect(() => cancelHide, [cancelHide]);

  useEffect(() => {
    if (!native) return;
    const tip = tipRef.current;
    if (!tip) return;
    try {
      if (show && !tip.matches(":popover-open")) tip.showPopover();
      if (!show && tip.matches(":popover-open")) tip.hidePopover();
    } catch {
      // Detached or already in the requested state.
    }
    const onToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === "closed") setShow(false);
    };
    tip.addEventListener("toggle", onToggle);
    return () => tip.removeEventListener("toggle", onToggle);
  }, [native, show]);

  return { show, open, close, closeSoon, cancelHide, tipRef };
}

const useAnchoredPopover = () =>
  useSyncExternalStore(noopSubscribe, supportsAnchoredPopover, () => false);

const anchorNameFor = (id: string) =>
  `--tip-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;

const anchoredTipStyle = (anchorName: string): React.CSSProperties => ({
  positionAnchor: anchorName,
  positionArea: "top",
  positionTryFallbacks: "flip-block, flip-inline",
  inset: "auto",
  // Side margins keep a flipped or shifted tip off the viewport edge.
  margin: "0 0.5rem 0.5rem",
  maxWidth: "min(20rem, calc(100vw - 1rem))",
});

export const Tooltip = ({
  children,
  text,
}: {
  children: React.ReactNode;
  text: string;
}) => {
  const tooltipId = useId();
  const anchorName = anchorNameFor(tooltipId);
  const native = useAnchoredPopover();
  const { show, open, close, closeSoon, cancelHide, tipRef } = useHint(native);
  // The popover stays in the DOM, so it can always describe the trigger.
  // Without it the tip exists only while shown, as before.
  const describedBy = native || show ? tooltipId : undefined;

  return (
    <span
      className="relative inline-block cursor-help"
      onMouseEnter={open}
      onMouseLeave={closeSoon}
    >
      <button
        type="button"
        tabIndex={0}
        aria-describedby={describedBy}
        data-tooltip-trigger=""
        onFocus={open}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            close();
            e.currentTarget.focus();
          }
        }}
        style={{
          font: "inherit",
          ...(native ? { anchorName } : null),
        }}
        className="bg-transparent p-0 m-0 border-0 outline-none align-baseline inline text-inherit cursor-help focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <span className="border-b border-dashed border-zinc-500">
          {children}
        </span>
      </button>
      {native ? (
        <div
          ref={tipRef}
          id={tooltipId}
          role="tooltip"
          {...{ popover: "hint" }}
          onMouseEnter={cancelHide}
          onMouseLeave={closeSoon}
          style={anchoredTipStyle(anchorName)}
          className={`${TIP_CLASSES} overflow-visible`}
        >
          {text}
        </div>
      ) : (
        <AnimatePresence>
          {show && (
            <motion.div
              id={tooltipId}
              role="tooltip"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              onMouseEnter={cancelHide}
              className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 ${TIP_CLASSES}`}
            >
              {text}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </span>
  );
};

/** Gap in pixels between a fallback tip and its button or the viewport. */
const FALLBACK_GAP_PX = 8;

/** A button whose tooltip text replaces the native `title` tooltip. */
type TooltipButtonProps = React.ComponentPropsWithRef<"button"> & {
  /** Hint shown on hover and focus; no tip when undefined. */
  readonly tooltip?: string;
};

/**
 * A button with a hint that keyboard, touch and pointer users all see, in
 * place of `title`, which only shows on mouse hover (#3978). The hint shows
 * on hover and focus, hides on Escape and blur, and stays hoverable. It
 * describes the button unless it repeats the button's `aria-label`. An
 * icon-only button still needs its own `aria-label`.
 */
export const TooltipButton = ({
  tooltip,
  ref,
  style,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onKeyDown,
  "aria-describedby": ariaDescribedBy,
  ...props
}: TooltipButtonProps) => {
  const tipId = useId();
  const anchorName = anchorNameFor(tipId);
  const native = useAnchoredPopover();
  const { show, open, close, closeSoon, cancelHide, tipRef } = useHint(native);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [fallbackPosition, setFallbackPosition] =
    useState<React.CSSProperties | null>(null);
  const hasTip = typeof tooltip === "string" && tooltip.length > 0;

  const setRefs = useCallback(
    (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    },
    [ref]
  );

  const reveal = useCallback(() => {
    if (!hasTip) return;
    if (!native && buttonRef.current) {
      // Without anchor positioning, place a fixed tip above the button, or
      // below it near the top edge, and keep its centre on screen.
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth || rect.right;
      const centre = clamp(
        rect.left + rect.width / 2,
        FALLBACK_GAP_PX,
        Math.max(FALLBACK_GAP_PX, viewportWidth - FALLBACK_GAP_PX)
      );
      const above = rect.top > 48;
      setFallbackPosition({
        position: "fixed",
        left: centre,
        top: above ? rect.top - FALLBACK_GAP_PX : rect.bottom + FALLBACK_GAP_PX,
        transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
        maxWidth: `min(20rem, calc(100vw - ${FALLBACK_GAP_PX * 2}px))`,
      });
    }
    open();
  }, [hasTip, native, open]);

  // As in Tooltip, the fallback tip exists only while shown.
  const tipInDom = hasTip && (native || show);
  const describes = tipInDom && tooltip !== props["aria-label"];
  const describedBy =
    [ariaDescribedBy, describes ? tipId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <>
      <button
        {...props}
        ref={setRefs}
        aria-describedby={describedBy}
        style={native && hasTip ? { ...style, anchorName } : style}
        onMouseEnter={(event) => {
          onMouseEnter?.(event);
          reveal();
        }}
        onMouseLeave={(event) => {
          onMouseLeave?.(event);
          closeSoon();
        }}
        onFocus={(event) => {
          onFocus?.(event);
          reveal();
        }}
        onBlur={(event) => {
          onBlur?.(event);
          close();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.key === "Escape" && show) close();
        }}
      />
      {tipInDom ? (
        <div
          ref={tipRef}
          id={tipId}
          role="tooltip"
          {...(native ? { popover: "hint" } : null)}
          onMouseEnter={cancelHide}
          onMouseLeave={closeSoon}
          style={
            native
              ? anchoredTipStyle(anchorName)
              : (fallbackPosition ?? undefined)
          }
          className={`${TIP_CLASSES} ${native ? "overflow-visible" : "z-50"}`}
        >
          {tooltip}
        </div>
      ) : null}
    </>
  );
};
