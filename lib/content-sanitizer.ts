import DOMPurify from "isomorphic-dompurify";
import { CONTENT_SANITIZE_OPTIONS } from "./content-sanitize-options";

/**
 * Sanitizes persisted editorial HTML with the shared CaseStudy and BlogPost
 * allowlist, dropping executable markup, event attributes, and inline styles.
 */
export function sanitizeContentHtml(content: string): string {
  return DOMPurify.sanitize(content, CONTENT_SANITIZE_OPTIONS);
}
