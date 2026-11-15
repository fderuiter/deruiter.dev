/**
 * Utility to parse headings (h2, h3) from blog post HTML,
 * generate clean and unique anchor IDs, and inject IDs into the HTML tags.
 */

import { htmlToText } from "@/lib/html-text";

export interface HeadingItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Prefix applied to generated anchor IDs. Without it, headings such as
 * "Images" or "Title" produce ids that DOMPurify's anti-clobbering pass strips.
 */
const GENERATED_ID_PREFIX = "section-";

/**
 * Turns a plain-text heading label into a URL-friendly anchor slug.
 *
 * The input is text, not HTML: callers extract the label first (as
 * extractAndInjectHeadings does). The output alphabet is only lowercase
 * word characters and single dashes, so no markup or quote can reach an id
 * whatever the input holds (#3837). An empty result falls back to
 * "section".
 */
export function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // keep word characters, whitespace and dashes
    .trim()
    .replace(/\s+/g, "-") // replace whitespace with dashes
    .replace(/-+/g, "-"); // collapse duplicate dashes

  return slug || "section";
}

/**
 * Extracts h2 and h3 headings from an HTML string, generates unique slug IDs,
 * and ensures each heading tag carries an `id` attribute for anchor navigation.
 */
export function extractAndInjectHeadings(html: string): {
  html: string;
  headings: HeadingItem[];
} {
  if (!html || typeof html !== "string") {
    return { html: html || "", headings: [] };
  }

  const headings: HeadingItem[] = [];
  const usedIds = new Set<string>();

  // Regular expression targeting h2 and h3 headings
  const headingRegex = /<(h[23])(\b[^>]*)>([\s\S]*?)<\/\1>/gi;
  // Matches a real `id` attribute, not `data-id` or `aria-...id`
  const idAttrRegex = /(?:^|\s)id\s*=\s*(["'])(.*?)\1/i;

  // Reserve explicit ids first so generated ids never duplicate them
  for (const match of html.matchAll(headingRegex)) {
    const explicit = idAttrRegex.exec(match[2]);
    if (explicit?.[2]) {
      usedIds.add(explicit[2]);
    }
  }

  const modifiedHtml = html.replace(
    headingRegex,
    (_fullMatch, tag: string, attributes: string, innerContent: string) => {
      const level = tag.toLowerCase() === "h2" ? 2 : 3;

      // The TOC label is the heading's visible text, read once (#3838)
      const cleanText = htmlToText(innerContent).trim();

      // Check if the heading already has an id attribute
      const idMatch = idAttrRegex.exec(attributes);
      let id: string;

      if (idMatch && idMatch[2]) {
        id = idMatch[2];
      } else {
        const baseSlug = `${GENERATED_ID_PREFIX}${slugifyHeading(cleanText)}`;
        let count = 0;
        id = baseSlug;
        while (usedIds.has(id)) {
          count += 1;
          id = `${baseSlug}-${count}`;
        }
        usedIds.add(id);
      }

      headings.push({
        id,
        text: cleanText,
        level,
      });

      // If id is already present, keep attributes as-is
      if (idMatch && idMatch[2]) {
        return `<${tag}${attributes}>${innerContent}</${tag}>`;
      }

      // Inject the id attribute
      return `<${tag} id="${id}"${attributes}>${innerContent}</${tag}>`;
    }
  );

  return {
    html: modifiedHtml,
    headings,
  };
}
