/**
 * Shared allowlist for persisted editorial HTML. This is the established
 * CaseStudy architectural-narrative policy, also required for BlogPost bodies
 * by ADR 0041 and CMS_GUIDELINES.md.
 */
export const CONTENT_SANITIZE_OPTIONS = {
  ALLOWED_TAGS: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "code",
    "pre",
    "strong",
    "em",
    "b",
    "i",
    "a",
    "ul",
    "ol",
    "li",
    "span",
    "abbr",
    "blockquote",
    "br",
    "div",
  ],
  ALLOWED_ATTR: [
    "id",
    "href",
    "target",
    "rel",
    "class",
    "data-term",
    "data-definition",
    "data-key",
    "role",
    "tabindex",
    "aria-label",
    "aria-describedby",
    "aria-hidden",
  ],
};
