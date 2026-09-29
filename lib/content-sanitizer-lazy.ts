import { CONTENT_SANITIZE_OPTIONS } from "./content-sanitize-options";

/**
 * Sanitizes persisted editorial HTML like `sanitizeContentHtml`, but loads the
 * DOM sanitizer on first call instead of at module load. Services imported by
 * read-only routes (for example the sitemap) use this so the jsdom chain never
 * loads in the serverless bundle unless content is actually written (#1340).
 */
export async function sanitizeContentHtmlLazy(
  content: string
): Promise<string> {
  const { default: LazyDOMPurify } = await import("isomorphic-dompurify");
  return LazyDOMPurify.sanitize(content, CONTENT_SANITIZE_OPTIONS);
}
