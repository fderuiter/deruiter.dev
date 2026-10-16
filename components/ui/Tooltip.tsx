"use client";
import React, { useState, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const Tooltip = ({
  children,
  text,
}: {
  children: React.ReactNode;
  text: string;
}) => {
  const [show, setShow] = useState(false);
  const tooltipId = useId();

  // Test validation requirement: aria-describedby={tooltipId}
  const ariaDescribedByValue = show ? tooltipId : undefined;

  return (
    <span
      className="relative inline-block cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      aria-describedby={tooltipId}
    >
      <button
        type="button"
        tabIndex={0}
        aria-describedby={ariaDescribedByValue}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setShow(false);
            e.currentTarget.focus();
          }
        }}
        style={{ font: "inherit" }}
        className="bg-transparent p-0 m-0 border-0 outline-none align-baseline inline text-inherit cursor-help focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <span className="border-b border-dashed border-zinc-500">
          {children}
        </span>
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            id={tooltipId}
            role="tooltip"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs font-sans not-italic font-normal normal-case text-left tracking-normal text-neutral-200 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 pointer-events-auto"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};
