/**
 * Finds buttons by their TooltipButton hint (#4083). TooltipButton renders
 * the hint in `data-tooltip`, so tests that once queried `title` keep a
 * stable hook without showing the tip.
 */
export function getAllByTooltip(
  text: string | RegExp,
  root: ParentNode = document
): HTMLElement[] {
  const matches = [
    ...root.querySelectorAll<HTMLElement>("[data-tooltip]"),
  ].filter((element) => {
    const tip = element.dataset.tooltip ?? "";
    return typeof text === "string" ? tip === text : text.test(tip);
  });
  if (matches.length === 0) {
    throw new Error(`No element has the tooltip ${String(text)}`);
  }
  return matches;
}

/** The one element whose tooltip matches; throws on none or several. */
export function getByTooltip(
  text: string | RegExp,
  root: ParentNode = document
): HTMLElement {
  const matches = getAllByTooltip(text, root);
  if (matches.length > 1) {
    throw new Error(
      `${matches.length} elements have the tooltip ${String(text)}`
    );
  }
  return matches[0];
}
