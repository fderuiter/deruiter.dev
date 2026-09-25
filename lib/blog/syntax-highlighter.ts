import DOMPurify from "isomorphic-dompurify";

export const SUPPORTED_CODE_LANGUAGES = new Set([
  "javascript",
  "js",
  "jsx",
  "rs",
  "rust",
  "ts",
  "tsx",
  "typescript",
]);

const JS_TS_KEYWORDS = new Set(
  "as async await break case catch class const continue default else export extends finally for from function if implements import in instanceof interface let new of return static switch throw try type typeof var void while yield".split(
    " "
  )
);
const JS_TS_LITERALS = new Set("false NaN null true undefined".split(" "));

const RUST_KEYWORDS = new Set(
  "as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return Self self static struct super trait type unsafe use where while".split(
    " "
  )
);
const RUST_LITERALS = new Set("false None Ok Err Some true".split(" "));

const CODE_TOKEN_PATTERN =
  /\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b[A-Za-z_$][\w$]*\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|===|!==|=>|==|!=|<=|>=|&&|\|\||\+\+|--|[-=<>+*\/%&|^!~?:]/g;

const CODE_NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": "\u00a0",
};

/**
 * Decodes standard and numerical HTML entities in raw code content.
 *
 * @param source Raw code text containing potential HTML entities.
 * @returns Decoded plaintext string.
 */
export function decodeCodeEntities(source: string): string {
  return source.replace(
    /&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi,
    (entity) => {
      const named = CODE_NAMED_ENTITIES[entity.toLowerCase()];
      if (named) return named;

      const numeric = /^&#(x[\da-f]+|\d+);$/i.exec(entity);
      if (!numeric) return entity;

      const codePoint = numeric[1].toLowerCase().startsWith("x")
        ? Number.parseInt(numeric[1].slice(1), 16)
        : Number.parseInt(numeric[1], 10);
      if (
        !Number.isInteger(codePoint) ||
        codePoint < 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        return entity;
      }

      return String.fromCodePoint(codePoint);
    }
  );
}

/**
 * Escapes characters that have syntactic meaning in HTML.
 *
 * @param source Raw plaintext string.
 * @returns HTML-safe string.
 */
export function escapeCodeText(source: string): string {
  return source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Determines the syntax token classification for a matched token in a given language.
 *
 * @param token The matched token substring.
 * @param language The canonical code language identifier.
 * @returns The token class name suffix or null if untokenized.
 */
export function getCodeTokenClass(
  token: string,
  language: string
): "comment" | "string" | "number" | "literal" | "keyword" | "operator" | null {
  if (token.startsWith("//") || token.startsWith("/*")) {
    return "comment";
  }
  if (token.startsWith('"') || token.startsWith("'") || token.startsWith("`")) {
    return "string";
  }
  if (/^\d/.test(token)) {
    return "number";
  }

  const lang = language.toLowerCase();
  if (lang === "rust" || lang === "rs") {
    if (RUST_LITERALS.has(token)) return "literal";
    if (RUST_KEYWORDS.has(token)) return "keyword";
  } else {
    if (JS_TS_LITERALS.has(token)) return "literal";
    if (JS_TS_KEYWORDS.has(token)) return "keyword";
  }

  if (
    /^(?:===|!==|=>|==|!=|<=|>=|&&|\|\||\+\+|--|[-=<>+*\/%&|^!~?:])$/.test(
      token
    )
  ) {
    return "operator";
  }

  return null;
}

/**
 * Deterministically tokenizes source code for supported languages into safe HTML spans.
 *
 * @param source Raw decoded source text.
 * @param language Target language string.
 * @returns HTML snippet with syntax token span elements.
 */
export function tokenizeCode(source: string, language: string): string {
  let result = "";
  let lastIndex = 0;

  for (const match of source.matchAll(CODE_TOKEN_PATTERN)) {
    const token = match[0];
    const index = match.index ?? lastIndex;
    result += escapeCodeText(source.slice(lastIndex, index));

    const tokenClass = getCodeTokenClass(token, language);
    result += tokenClass
      ? `<span class="blog-code-token--${tokenClass}">${escapeCodeText(token)}</span>`
      : escapeCodeText(token);
    lastIndex = index + token.length;
  }

  return result + escapeCodeText(source.slice(lastIndex));
}

/**
 * Injects syntax-highlighted spans into preformatted code blocks within sanitized HTML.
 * Unsupported languages and unannotated blocks remain safely unmodified.
 *
 * @param html Sanitized article HTML containing pre and code blocks.
 * @returns HTML with tokenized code blocks.
 */
export function highlightCodeBlocks(html: string): string {
  return html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, (preBlock) => {
    const codeMatch = /(<code\b([^>]*)>)([\s\S]*?)(<\/code>)/i.exec(preBlock);
    if (!codeMatch || /<\/?[a-z][^>]*>/i.test(codeMatch[3])) {
      return preBlock;
    }

    const codeClasses = codeMatch[2];
    const preClasses = /<pre\b([^>]*)>/i.exec(preBlock)?.[1] || "";
    const languageMatch = /\blanguage-([a-zA-Z0-9_-]+)/i.exec(
      `${codeClasses} ${preClasses}`
    );
    const language = languageMatch?.[1].toLowerCase();
    if (!language || !SUPPORTED_CODE_LANGUAGES.has(language)) {
      return preBlock;
    }

    const source = decodeCodeEntities(codeMatch[3]);
    const tokens = DOMPurify.sanitize(tokenizeCode(source, language), {
      ALLOWED_TAGS: ["span"],
      ALLOWED_ATTR: ["class"],
    });
    const replacedCode = `${codeMatch[1]}${tokens}${codeMatch[4]}`;
    return preBlock.replace(codeMatch[0], replacedCode);
  });
}
