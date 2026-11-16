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

export const Tooltip = ({
  children,
  text,
}: {
  children: React.ReactNode;
  text: string;
}) => {
  const [show, setShow] = useState(false);
  const tooltipId = useId();
  const anchorName = `--tip-${tooltipId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const native = useSyncExternalStore(
    noopSubscribe,
    supportsAnchoredPopover,
    () => false
  );
  const tipRef = useRef<HTMLDivElement | null>(null);
  // The popover stays in the DOM, so it can always describe the trigger.
  // Without it the tip exists only while shown, as before.
  const describedBy = native || show ? tooltipId : undefined;
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

  // Mirror the state onto the popover, and follow the browser when it
  // light-dismisses a hint (Escape, or another popover opening).
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
          style={{
            positionAnchor: anchorName,
            positionArea: "top",
            positionTryFallbacks: "flip-block, flip-inline",
            inset: "auto",
            // Side margins keep a flipped or shifted tip off the viewport edge.
            margin: "0 0.5rem 0.5rem",
            maxWidth: "min(20rem, calc(100vw - 1rem))",
          }}
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
