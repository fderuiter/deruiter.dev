/**
 * Route filter for the page benchmark CLI (`--routes`).
 *
 * The filter used to be compiled with `new RegExp`, so a nested quantifier
 * from the command line could backtrack for a very long time (CodeQL alerts
 * 31 and 32, #3821 and #3822). Its only inputs are the operator's own
 * arguments, and no workflow passes `--routes` today, but the contract is
 * now bounded on purpose: a filter is a small pattern language that is
 * matched without a regular expression engine, in time linear in the
 * pattern length times the text length.
 *
 * The language keeps the regex features the CLI documented in practice:
 * alternatives separated by `|`, a leading `^` and a trailing `$` per
 * alternative, `.` for any one character, and a backslash before a
 * punctuation character to make it literal. Matching is case-insensitive
 * and finds the alternative anywhere in the text unless it is anchored.
 * Quantifiers, groups, classes and other escapes are refused with an error
 * that names the problem, so an existing filter never silently changes
 * meaning.
 */

/** Longest filter the CLI accepts. */
export const MAX_ROUTE_FILTER_LENGTH = 200;

type FilterToken = { readonly kind: "any" } | { readonly kind: "char"; readonly value: string };

interface FilterAlternative {
  readonly anchoredStart: boolean;
  readonly anchoredEnd: boolean;
  readonly tokens: readonly FilterToken[];
}

/** A validated `--routes` filter. */
export interface RouteFilter {
  /** The filter as the operator typed it. */
  readonly source: string;
  /** Whether the filter matches somewhere in `text`, ignoring case. */
  test(text: string): boolean;
}

const UNSUPPORTED = new Set(["*", "+", "?", "{", "}", "(", ")", "[", "]"]);
const ESCAPABLE = /^[^A-Za-z0-9]$/;

function describe(character: string): string {
  return JSON.stringify(character);
}

function parseAlternative(text: string): FilterAlternative {
  let body = text;
  const anchoredStart = body.startsWith("^");
  if (anchoredStart) body = body.slice(1);
  let anchoredEnd = false;
  if (body.endsWith("$") && !body.endsWith("\\$")) {
    anchoredEnd = true;
    body = body.slice(0, -1);
  }
  const tokens: FilterToken[] = [];
  for (let index = 0; index < body.length; index++) {
    const character = body[index];
    if (character === "\\") {
      const escaped = body[index + 1];
      if (escaped === undefined) {
        throw new Error("--routes cannot end with a backslash.");
      }
      if (!ESCAPABLE.test(escaped)) {
        throw new Error(
          `--routes supports a backslash only before punctuation, not before ${describe(escaped)}.`
        );
      }
      tokens.push({ kind: "char", value: escaped.toLowerCase() });
      index++;
    } else if (character === ".") {
      tokens.push({ kind: "any" });
    } else if (character === "^" || character === "$") {
      throw new Error(
        `--routes supports ${describe(character)} only at the edge of an alternative.`
      );
    } else if (UNSUPPORTED.has(character)) {
      throw new Error(
        `--routes does not support ${describe(character)}. Use path or name text, "." for any character, "^" and "$" anchors, and "|" between alternatives.`
      );
    } else {
      tokens.push({ kind: "char", value: character.toLowerCase() });
    }
  }
  return { anchoredStart, anchoredEnd, tokens };
}

function matchesAt(
  tokens: readonly FilterToken[],
  text: string,
  start: number
): boolean {
  for (let offset = 0; offset < tokens.length; offset++) {
    const token = tokens[offset];
    if (token.kind === "char" && token.value !== text[start + offset]) {
      return false;
    }
  }
  return true;
}

function alternativeMatches(alternative: FilterAlternative, text: string): boolean {
  const { tokens, anchoredStart, anchoredEnd } = alternative;
  const last = text.length - tokens.length;
  if (last < 0) return false;
  if (anchoredStart && anchoredEnd) {
    return last === 0 && matchesAt(tokens, text, 0);
  }
  if (anchoredStart) return matchesAt(tokens, text, 0);
  if (anchoredEnd) return matchesAt(tokens, text, last);
  for (let start = 0; start <= last; start++) {
    if (matchesAt(tokens, text, start)) return true;
  }
  return false;
}

/**
 * Validates a `--routes` filter and returns its matcher.
 *
 * @param source - The filter text from the command line.
 * @returns A matcher for route paths and names.
 * @throws When the filter is empty, longer than the limit, or uses a
 * feature outside the supported pattern language.
 */
export function compileRouteFilter(source: string): RouteFilter {
  if (source.length === 0) throw new Error("--routes requires a pattern.");
  if (source.length > MAX_ROUTE_FILTER_LENGTH) {
    throw new Error(
      `--routes is limited to ${MAX_ROUTE_FILTER_LENGTH} characters (got ${source.length}).`
    );
  }
  const alternatives = splitAlternatives(source).map(parseAlternative);
  if (alternatives.some((alternative) => alternative.tokens.length === 0)) {
    throw new Error("--routes has an empty alternative.");
  }
  return {
    source,
    test: (text: string) => {
      const lower = text.toLowerCase();
      return alternatives.some((alternative) =>
        alternativeMatches(alternative, lower)
      );
    },
  };
}

/** Splits on `|` that is not escaped. */
function splitAlternatives(source: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === "\\" && index + 1 < source.length) {
      current += character + source[index + 1];
      index++;
    } else if (character === "|") {
      parts.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  parts.push(current);
  return parts;
}
