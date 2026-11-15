import {
  CANONICAL_GLOSSARY,
  getGlossaryKeyMap,
  getSortedTermEntries,
  TermDefinition,
} from "./term-glossary";
import { escapeXml } from "./utils";
import { decodeHtmlEntities } from "./html-text";

export function escapeAttr(str: string): string {
  return escapeXml(str, { singleQuoteEntity: "&#39;" });
}

/**
 * Cache for search pattern RegExps to avoid redundant pattern instantiations.
 */
const boundaryPatternCache = new Map<string, RegExp>();

/**
 * Resets the boundary pattern cache. Useful for testing or flushing cache state.
 */
export function resetPatternCache(): void {
  boundaryPatternCache.clear();
}

/**
 * Retrieves or builds a cached boundary matching RegExp for a given phrase.
 */
function getBoundaryRegex(phrase: string): RegExp {
  let cached = boundaryPatternCache.get(phrase);
  if (!cached) {
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const startsWithWordChar = /^\w/.test(phrase);
    const endsWithWordChar = /\w$/.test(phrase);

    const prefix = startsWithWordChar ? "(?<=^|\\W)" : "(?<=^|\\s)";
    const suffix = endsWithWordChar ? "(?=$|\\W)" : "(?=$|\\s|[.,;:!?<])";

    cached = new RegExp(`${prefix}${escapedPhrase}${suffix}`, "gi");
    boundaryPatternCache.set(phrase, cached);
  }
  // Safely reset lastIndex state across matching passes
  cached.lastIndex = 0;
  return cached;
}

/**
 * Splits input HTML/text into protected tokens (HTML tags, code blocks, existing terminology tags)
 * and plain text tokens available for term substitution.
 */
function tokenizeHtml(
  input: string
): Array<{ isText: boolean; content: string }> {
  // Regex matches HTML comments, fenced code blocks, inline backtick code, <code>, <pre>, existing terminology tags, or general HTML tags
  const tagRegex =
    /(<!--[\s\S]*?-->|```[\s\S]*?```|`[^`\n]+`|<code\b[\s\S]*?<\/code>|<pre\b[\s\S]*?<\/pre>|<span\b[^>]*data-key=[\s\S]*?<\/span>|<abbr\b[^>]*data-key=[\s\S]*?<\/abbr>|<[^>]+>)/gi;

  const tokens: Array<{ isText: boolean; content: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        isText: true,
        content: input.slice(lastIndex, match.index),
      });
    }
    tokens.push({
      isText: false,
      content: match[0],
    });
    lastIndex = tagRegex.lastIndex;
  }

  if (lastIndex < input.length) {
    tokens.push({
      isText: true,
      content: input.slice(lastIndex),
    });
  }

  return tokens;
}

/**
 * Compiles plain text or HTML prose into standardized terminology markup tags.
 * Preserves code blocks, existing term tags, and word boundaries.
 */
export function compileTerms(
  input: string,
  glossary: TermDefinition[] = CANONICAL_GLOSSARY
): string {
  if (!input) return "";

  const termEntries = getSortedTermEntries(glossary);
  let tokens = tokenizeHtml(input);
  const inputLower = input.toLowerCase();

  for (const { phrase, entry } of termEntries) {
    if (!inputLower.includes(phrase.toLowerCase())) {
      continue;
    }

    const nextTokens: Array<{ isText: boolean; content: string }> = [];

    for (const token of tokens) {
      if (!token.isText || !token.content) {
        nextTokens.push(token);
        continue;
      }

      const regex = getBoundaryRegex(phrase);

      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let hasMatches = false;

      while ((match = regex.exec(token.content)) !== null) {
        hasMatches = true;
        const matchedText = match[0];
        const matchIndex = match.index;

        if (matchIndex > lastIndex) {
          nextTokens.push({
            isText: true,
            content: token.content.slice(lastIndex, matchIndex),
          });
        }

        const compiledSpan = `<span data-key="${entry.key}" data-term="${escapeAttr(
          entry.simplified
        )}" data-definition="${escapeAttr(entry.definition)}">${matchedText}</span>`;

        nextTokens.push({
          isText: false, // Protect newly compiled term tag from subsequent phrases
          content: compiledSpan,
        });

        lastIndex = regex.lastIndex;
      }

      if (!hasMatches) {
        nextTokens.push(token);
      } else if (lastIndex < token.content.length) {
        nextTokens.push({
          isText: true,
          content: token.content.slice(lastIndex),
        });
      }
    }

    tokens = nextTokens;
  }

  return tokens.map((t) => t.content).join("");
}

export interface TermValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates term tags in HTML or text strings against the canonical glossary.
 * Extracts element metadata attributes (keys, terms, definitions) in a single pass per tag.
 */
export function validateTermTags(
  html: string,
  glossary: TermDefinition[] = CANONICAL_GLOSSARY,
  source = "inline-content"
): TermValidationResult {
  const errors: string[] = [];
  const glossaryMap = getGlossaryKeyMap(glossary);

  // Match terminology tags e.g. <span data-key="...">...</span> or <abbr ...>...</abbr> or tags carrying data-key/data-term/data-definition
  const termTagRegex =
    /<(span|abbr)\b([^>]*)>([\s\S]*?)<\/\1>|<([a-z0-9]+)\b([^>]*(?:data-key|data-term|data-definition)[^>]*)>([\s\S]*?)<\/\4>/gi;

  let match: RegExpExecArray | null;
  while ((match = termTagRegex.exec(html)) !== null) {
    const tagName = (match[1] || match[4]).toLowerCase();
    const rawAttrs = match[2] || match[5];
    const outerHTML = match[0];

    // Assert tag is span or abbr
    if (tagName !== "span" && tagName !== "abbr") {
      errors.push(
        `[${source}] Tag <${tagName}> carries terminology attributes but must be <span> or <abbr>. Outer HTML: ${outerHTML}`
      );
      continue;
    }

    // Single scanning pass per tag to extract all metadata attributes
    const attrPassRegex =
      /data-(key|term|definition)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
    let attrMatch: RegExpExecArray | null;
    let keyVal = "";
    let termVal = "";
    let defVal = "";

    while ((attrMatch = attrPassRegex.exec(rawAttrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const val = (attrMatch[2] ?? attrMatch[3] ?? "").trim();
      if (attrName === "key") keyVal = val;
      else if (attrName === "term") termVal = val;
      else if (attrName === "definition") defVal = val;
    }

    const missing: string[] = [];
    if (!keyVal) missing.push("data-key");
    if (!termVal) missing.push("data-term");
    if (!defVal) missing.push("data-definition");

    if (missing.length > 0) {
      errors.push(
        `[${source}] Terminology tag <${tagName}> has missing/empty attributes: [${missing.join(
          ", "
        )}]. Outer HTML: ${outerHTML}`
      );
      continue;
    }

    // Assert key exists in canonical dictionary
    const expected = glossaryMap.get(keyVal);
    if (!expected) {
      errors.push(
        `[${source}] Terminology tag has invalid/unrecognized data-key="${keyVal}". Outer HTML: ${outerHTML}`
      );
      continue;
    }

    // Decode attribute entities once for comparison (#3833)
    const unescapeAttr = decodeHtmlEntities;

    // Assert consistency with glossary definition
    if (unescapeAttr(termVal) !== expected.simplified) {
      errors.push(
        `[${source}] Terminology tag data-term mismatch for key "${keyVal}": expected "${expected.simplified}", got "${unescapeAttr(termVal)}". Outer HTML: ${outerHTML}`
      );
    }
    if (unescapeAttr(defVal) !== expected.definition) {
      errors.push(
        `[${source}] Terminology tag data-definition mismatch for key "${keyVal}": expected "${expected.definition}", got "${unescapeAttr(defVal)}". Outer HTML: ${outerHTML}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
