/**
 * Page scrolling for For Better or Bulk. The cabinet's clipped ancestors are
 * scroll containers of their own, so `scrollIntoView` ignores an element's
 * scroll margin there and parks it under the sticky navbar. These helpers
 * scroll the window by hand instead.
 */

/** Whether the viewer asked for less motion; a scroll then jumps instead of gliding. */
export function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
  );
}

/**
 * Scrolls the page so the element's top sits its scroll margin below the
 * viewport top, clear of the navbar. The margin is read from the element's
 * computed `scroll-margin-top` (for example the `scroll-mt-28` class).
 */
export function scrollBelowNavbar(element: HTMLElement): void {
  if (typeof window.scrollTo !== "function") return;
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  window.scrollTo({
    top: Math.max(
      0,
      window.scrollY + element.getBoundingClientRect().top - margin
    ),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}
