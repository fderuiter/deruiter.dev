"use client";

import React, { ReactNode, useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/utils";

export interface ModalContainerProps {
  /**
   * Whether the modal dialog is currently visible.
   */
  isOpen: boolean;
  /**
   * Callback triggered when user requests to close the modal.
   */
  onClose: () => void;
  /**
   * Optional DOM id referencing the modal title element for aria-labelledby.
   */
  titleId?: string;
  /**
   * Optional direct ARIA label if no title element is present.
   */
  ariaLabel?: string;
  /**
   * Optional DOM id referencing the description element for aria-describedby.
   */
  ariaDescribedBy?: string;
  /**
   * Ref for the element to focus immediately upon opening.
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * Whether focus should be restored to the triggering element when closed. Defaults to true.
   */
  returnFocus?: boolean;
  /**
   * Whether clicking the backdrop overlay triggers onClose. Defaults to true.
   */
  closeOnBackdropClick?: boolean;
  /**
   * Whether pressing the Escape key triggers onClose. Defaults to true.
   */
  closeOnEscape?: boolean;
  /**
   * Additional keydown handler for custom shortcuts while modal is open.
   */
  onKeyDown?: (e: KeyboardEvent) => void;
  /**
   * Maximum width Tailwind class for the modal content box. Defaults to "max-w-2xl".
   */
  maxWidth?: string;
  /**
   * Additional class names for the outer backdrop overlay container.
   */
  overlayClassName?: string;
  /**
   * Additional class names for the inner modal box container.
   */
  className?: string;
  /**
   * Content inside the modal dialog.
   */
  children: ReactNode;
}

/**
 * Standardized, accessible modal dialog container enforcing vertical content scrolling,
 * WCAG focus containment via useFocusTrap, Escape key dismissal, backdrop backdrop-blur,
 * and safe viewport max height constraints (max-h-[85vh] / max-h-[90dvh]).
 */
export function ModalContainer({
  isOpen,
  onClose,
  titleId,
  ariaLabel,
  ariaDescribedBy,
  initialFocusRef,
  returnFocus = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  onKeyDown,
  maxWidth = "max-w-2xl",
  overlayClassName = "",
  className = "",
  children,
}: ModalContainerProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    initialFocusRef,
    onEscape: closeOnEscape ? onClose : undefined,
    returnFocus,
    onKeyDown,
  });
  // A click event targets the nearest common ancestor of its mousedown and
  // mouseup, so a drag that starts inside the panel (a range slider, a text
  // selection) and is released over the backdrop arrives as a backdrop
  // click. Only a press that also began on the backdrop may dismiss.
  const pressStartedOnBackdropRef = useRef<boolean | null>(null);

  if (!isOpen) return null;

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    pressStartedOnBackdropRef.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const pressStartedOnBackdrop = pressStartedOnBackdropRef.current !== false;
    pressStartedOnBackdropRef.current = null;
    if (
      closeOnBackdropClick &&
      e.target === e.currentTarget &&
      pressStartedOnBackdrop
    ) {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto transition-opacity duration-200",
        overlayClassName
      )}
    >
      <div
        className={cn(
          "relative w-full max-h-[85vh] sm:max-h-[90dvh] flex flex-col min-w-0 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl text-zinc-100 overflow-y-auto focus:outline-none",
          maxWidth,
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
