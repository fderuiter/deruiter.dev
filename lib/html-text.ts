/**
 * Plain text from the small HTML and entity subset that site content uses.
 *
 * Content fields hold editorial HTML (terminology spans, headings) and
 * entity-escaped text. Readers that need the visible text call these instead
 * of deleting `<...>` spans with a regex, which drops text such as `Array<T>`
 * that was escaped as `&lt;T&gt;`, and instead of chained `.replace` calls,
 * which decode `&amp;lt;` twice (CodeQL alerts 15, 17, 18 and 23).
 *
 * The output is text for React children, metadata or comparisons. It is never
 * markup, so nothing here acts as an HTML sanitizer.
 *
 * @module
 */

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Decodes named entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, and
 * `&nbsp;` as a space) and numeric ones (`&#39;`, `&#x27;`) in one pass, so
 * `&amp;lt;` becomes `&lt;`, not `<`. Unknown or out-of-range entities stay
 * as written.
 *
 * @param text - Entity-escaped text.
 * @returns The decoded text.
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity[0] === "#") {
        const codePoint =
          entity[1].toLowerCase() === "x"
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        return Number.isFinite(codePoint) && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : match;
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    }
  );
}

/** Whether `<` at `index` opens a tag, comment or declaration. */
function opensMarkup(html: string, index: number): boolean {
  const next = html[index + 1];
  return next !== undefined && /[A-Za-z/!?]/.test(next);
}

/**
 * The visible text of an HTML fragment, read with a single left-to-right
 * scan. Tags and comments are dropped whole, with quoted attribute values
 * read as part of the tag, so a `>` inside quotes does not end it. A `<` that
 * does not open markup (as in `a < b`) is text. Markup left unterminated at
 * the end is dropped, since a browser would not show it either. Entities are
 * decoded once, after the scan, so decoded text is never read as markup.
 *
 * @param html - An HTML fragment.
 * @returns Its text, entities decoded.
 */
export function htmlToText(html: string): string {
  let text = "";
  let index = 0;
  while (index < html.length) {
    const char = html[index];
    if (char !== "<" || !opensMarkup(html, index)) {
      text += char;
      index += 1;
      continue;
    }
    if (html.startsWith("<!--", index)) {
      const end = html.indexOf("-->", index + 4);
      index = end === -1 ? html.length : end + 3;
      continue;
    }
    let quote: string | null = null;
    index += 1;
    while (index < html.length) {
      const inner = html[index];
      index += 1;
      if (quote) {
        if (inner === quote) quote = null;
      } else if (inner === '"' || inner === "'") {
        quote = inner;
      } else if (inner === ">") {
        break;
      }
    }
  }
  return decodeHtmlEntities(text);
}

/**
 * A plain-text summary of an editorial field written in light Markdown with
 * inline HTML: inline code keeps its literal text (so `Array<T>` survives),
 * other markup is read with {@link htmlToText}, and `**`, `*` and backtick
 * markers are dropped.
 *
 * @param markdown - The editorial field.
 * @param maxLength - The longest summary to return.
 * @returns The trimmed summary, at most `maxLength` characters.
 */
export function plainTextSummary(markdown: string, maxLength = 160): string {
  const parts = markdown.split(/(`[^`\n]+`)/);
  const text = parts
    .map((part, index) =>
      index % 2 === 1
        ? decodeHtmlEntities(part.slice(1, -1))
        : htmlToText(part).replace(/\*/g, "").replace(/`/g, "")
    )
    .join("");
  return text.trim().slice(0, maxLength);
}
