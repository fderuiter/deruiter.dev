"use client";

import React, { ReactNode, useEffect, useRef } from "react";
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

const supportsNativeModal = () =>
  typeof HTMLDialogElement !== "undefined" &&
  typeof HTMLDialogElement.prototype.showModal === "function";

/**
 * Standardized, accessible modal dialog built on the native dialog element
 * (#3975). showModal() puts it in the top layer and makes the rest of the page
 * inert, so no z-index or second focus trap is needed. useFocusTrap still runs
 * with Tab cycling off, for the shared trap stack, Escape ownership and focus
 * restoration. React owns visibility: the dialog mounts open while isOpen is
 * true and unmounts when it turns false. A user close request calls onClose
 * once; the dialog never closes itself.
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
  const containerRef = useFocusTrap<HTMLDialogElement>(isOpen, {
    initialFocusRef,
    onEscape: closeOnEscape ? onClose : undefined,
    returnFocus,
    onKeyDown,
    // Only where showModal() really makes the page inert; elsewhere (jsdom,
    // very old browsers) the trap keeps cycling Tab as before.
    trapTab: !supportsNativeModal(),
  });
  // A click event targets the nearest common ancestor of its mousedown and
  // mouseup, so a drag that starts inside the panel (a range slider, a text
  // selection) and is released over the backdrop arrives as a backdrop
  // click. Only a press that also began on the backdrop may dismiss.
  const pressStartedOnBackdropRef = useRef<boolean | null>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscapeRef.current = closeOnEscape;
  }, [onClose, closeOnEscape]);

  // Declared after useFocusTrap, so the trap records the trigger before
  // showModal() moves focus into the dialog.
  useEffect(() => {
    if (!isOpen) return;
    const dialog = containerRef.current;
    if (!dialog) return;
    let closeRequested = false;
    let closingOnUnmount = false;

    const isModal = () => {
      try {
        return dialog.matches(":modal");
      } catch {
        return dialog.open;
      }
    };

    const open = () => {
      if (dialog.open && isModal()) return;
      if (typeof dialog.showModal === "function") {
        if (dialog.open) dialog.close();
        try {
          dialog.showModal();
        } catch {
          // Not connected or already modal: leave it as it is.
        }
      } else {
        // Environments without showModal (jsdom) still get an open dialog.
        dialog.setAttribute("open", "");
      }
      initialFocusRef?.current?.focus();
    };

    const requestClose = () => {
      if (closeRequested) return;
      closeRequested = true;
      onCloseRef.current();
    };

    // Escape and the Android back gesture arrive as cancel. The dialog must
    // stay open until the parent drops isOpen, so the native close is always
    // prevented; the request goes to onClose only when Escape may close.
    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (closeOnEscapeRef.current) requestClose();
    };

    // A browser may still close the dialog after a prevented cancel (Chrome
    // does so for repeated requests without user activation). Treat that as
    // the user's close request, or reopen when Escape may not close.
    const handleClose = () => {
      if (closingOnUnmount) return;
      if (closeOnEscapeRef.current) requestClose();
      else if (dialog.isConnected) open();
    };

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    open();

    return () => {
      closingOnUnmount = true;
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
      if (!dialog.isConnected || !dialog.open) return;
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    };
  }, [isOpen, containerRef, initialFocusRef]);

  if (!isOpen) return null;

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    pressStartedOnBackdropRef.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
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
    <dialog
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={cn(
        // The dialog itself is the full-viewport scrim, so clicks on it are
        // backdrop clicks and the panel centres inside it. The UA box (margin,
        // max size, border, canvas background) is reset, and ::backdrop stays
        // clear because the scrim already covers the viewport.
        "fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-black/80 p-4 text-inherit backdrop:bg-transparent open:flex items-center justify-center backdrop-blur-sm overflow-y-auto overscroll-contain transition-opacity duration-200",
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
    </dialog>
  );
}
