/**
 * What a modal sheet leaves live: screen reader live regions, so the
 * cabinet's announcements still reach the player, and the cabinet's own
 * pause overlay and rotate prompt, which can open over a sheet.
 */
const KEEP_LIVE =
  '[aria-live], [role="status"], [role="alert"], [role="log"], [data-pause-overlay], [data-rotate-prompt]';

/** The element a sheet's inert background stops at. */
const SCOPE = "[data-arcade-cabinet], [data-sheet-scope]";

function inertBranch(parent: Element, keep: Element, made: HTMLElement[]) {
  for (const sibling of Array.from(parent.children)) {
    if (sibling === keep || !(sibling instanceof HTMLElement)) continue;
    if (sibling.hasAttribute("inert") || sibling.matches(KEEP_LIVE)) continue;
    if (sibling.querySelector(KEEP_LIVE)) {
      // Go one level in, so the live region itself stays out of it.
      inertBranch(sibling, sibling, made);
      continue;
    }
    sibling.setAttribute("inert", "");
    made.push(sibling);
  }
}

/**
 * Makes everything around `element` inert, up to the nearest cabinet (or
 * `[data-sheet-scope]`), or only its siblings outside one. Live regions, the
 * pause overlay and the rotate prompt stay live. Elements that were already
 * inert are left alone.
 *
 * @param element - The sheet that stays live.
 * @returns A function that clears exactly the `inert` it set.
 */
export function inertOthers(element: HTMLElement): () => void {
  const made: HTMLElement[] = [];
  const scope = element.parentElement?.closest(SCOPE) ?? null;
  let node: HTMLElement = element;
  while (node.parentElement) {
    const parent = node.parentElement;
    inertBranch(parent, node, made);
    if (!scope || parent === scope) break;
    node = parent;
  }
  return () => {
    for (const el of made) el.removeAttribute("inert");
  };
}
