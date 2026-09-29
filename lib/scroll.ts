/**
 * Accessible in-page scrolling.
 *
 * One place for the steps every in-page jump needs: find the target, scroll to
 * it without animating for readers who asked for reduced motion, and move
 * keyboard focus to it so screen readers announce where the reader landed.
 *
 * The fixed navbar offset is not computed here. Targets declare
 * `scroll-margin-top` in CSS (for example `calc(var(--navbar-height) + 2rem)`),
 * which `scrollIntoView` already honours.
 */

/** How the URL hash is synchronised after a jump. */
export type ScrollHashMode = "push" | "replace" | false;

/** Options accepted by {@link scrollToElement}. */
export interface ScrollToElementOptions {
  /**
   * Scroll animation requested by the caller. It is downgraded to `"auto"`
   * when the reader prefers reduced motion. Defaults to `"smooth"`.
   */
  behavior?: ScrollBehavior;
  /** Vertical alignment passed to `scrollIntoView`. Defaults to `"start"`. */
  block?: ScrollLogicalPosition;
  /**
   * Move keyboard focus to the target. A target that is not focusable gets a
   * `tabindex="-1"` that is removed again when it loses focus. Defaults to true.
   */
  focus?: boolean;
  /**
   * Write `#id` to the address bar with `history.pushState` ("push") or
   * `history.replaceState` ("replace"). Needs a target with an id. Defaults to
   * false, which leaves the URL untouched.
   */
  updateHash?: ScrollHashMode;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether the reader has asked the operating system for reduced motion.
 *
 * @returns False on the server and wherever `matchMedia` is unavailable.
 */
export function prefersReducedMotion(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * The scroll behavior to use once the reader's motion preference is applied.
 *
 * @param requested - The behavior the caller would like.
 * @returns `"auto"` when reduced motion is preferred, otherwise `requested`.
 */
export function resolveScrollBehavior(
  requested: ScrollBehavior = "smooth"
): ScrollBehavior {
  return requested === "smooth" && prefersReducedMotion() ? "auto" : requested;
}

function isFocusable(element: HTMLElement): boolean {
  // An explicit tabindex (including -1) makes any element programmatically
  // focusable; so does being a natively interactive element.
  if (element.hasAttribute("tabindex")) return true;
  return element.tabIndex >= 0;
}

function focusTarget(element: HTMLElement): void {
  if (!isFocusable(element)) {
    element.setAttribute("tabindex", "-1");
    element.addEventListener(
      "blur",
      () => element.removeAttribute("tabindex"),
      { once: true }
    );
  }
  // The scroll is already under way; focusing must not jump the viewport and
  // cut a smooth scroll short.
  element.focus({ preventScroll: true });
}

function syncHash(id: string, mode: Exclude<ScrollHashMode, false>): void {
  if (typeof window.history?.pushState !== "function") return;
  const hash = `#${id}`;
  if (window.location.hash === hash) return;
  if (mode === "replace") {
    window.history.replaceState(window.history.state, "", hash);
  } else {
    window.history.pushState(window.history.state, "", hash);
  }
}

/**
 * Scroll an element into view and, by default, move focus to it.
 *
 * Safe to call during server rendering, where it does nothing.
 *
 * @param target - The element, or the id of the element, to scroll to.
 * @param options - Animation, alignment, focus and URL hash settings.
 * @returns The element scrolled to, or null when it does not exist.
 */
export function scrollToElement(
  target: string | HTMLElement,
  options: ScrollToElementOptions = {}
): HTMLElement | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const element =
    typeof target === "string" ? document.getElementById(target) : target;
  if (!element) return null;

  const {
    behavior,
    block = "start",
    focus = true,
    updateHash = false,
  } = options;

  if (typeof element.scrollIntoView === "function") {
    element.scrollIntoView({
      behavior: resolveScrollBehavior(behavior),
      block,
    });
  }
  if (focus) {
    focusTarget(element);
  }
  if (updateHash && element.id) {
    syncHash(element.id, updateHash);
  }

  return element;
}
