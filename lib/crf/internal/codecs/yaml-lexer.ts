/**
 * Pure zero-dependency YAML 1.2 AST lexer and recursive-descent parser for Universal CRF `.yaml` / `.yml` specifications.
 * Runs identically in Node.js and browser environments without external libraries.
 */

export interface YamlAstScalarNode {
  readonly kind: "scalar";
  readonly value: string | number | boolean | null;
  readonly line: number;
}

export interface YamlAstSequenceNode {
  readonly kind: "sequence";
  readonly items: readonly YamlAstNode[];
  readonly line: number;
}

export interface YamlAstMappingEntry {
  readonly key: string;
  readonly value: YamlAstNode;
  readonly line: number;
}

export interface YamlAstMappingNode {
  readonly kind: "mapping";
  readonly entries: readonly YamlAstMappingEntry[];
  readonly line: number;
}

export type YamlAstNode =
  YamlAstScalarNode | YamlAstSequenceNode | YamlAstMappingNode;

export interface YamlLineToken {
  readonly indent: number;
  readonly content: string;
  readonly line: number;
}

/**
 * Maximum nesting depth accepted by `parseYamlAst`.
 */
export const MAX_YAML_NESTING_DEPTH = 64;

/**
 * Typed syntax and nesting error raised by `tokenizeYamlLines`, `parseYamlAst`, and `parseYaml`.
 */
export class YamlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YamlParseError";
  }
}

function stripCommentOutsideQuotes(rawLine: string): string {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < rawLine.length; i++) {
    const ch = rawLine[i];
    if (inDouble) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inDouble = false;
      }
      continue;
    }
    if (inSingle) {
      if (ch === "'" && rawLine[i + 1] === "'") {
        i++;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (ch === '"') {
      inDouble = true;
    } else if (ch === "'") {
      inSingle = true;
    } else if (ch === "#") {
      if (i === 0 || /\s/.test(rawLine[i - 1])) {
        return rawLine.slice(0, i).trimEnd();
      }
    }
  }

  if (inDouble || inSingle) {
    throw new YamlParseError("Unterminated quoted string in YAML line");
  }
  return rawLine.trimEnd();
}

function matchBlockScalarHeader(withoutComment: string): {
  prefix: string;
  style: "|" | ">";
  chomp: "" | "-" | "+";
} | null {
  const seqMatch = /^(-\s+)([|>])([-+]?)$/.exec(withoutComment);
  if (seqMatch) {
    return {
      prefix: seqMatch[1],
      style: seqMatch[2] as "|" | ">",
      chomp: seqMatch[3] as "" | "-" | "+",
    };
  }

  const isCompactSeq = withoutComment.startsWith("- ");
  const candidate = isCompactSeq ? withoutComment.slice(2) : withoutComment;
  const colonIdx = findMappingColon(candidate);
  if (colonIdx === -1) return null;

  const afterColon = candidate.slice(colonIdx + 1).trim();
  const blockMatch = /^([|>])([-+]?)$/.exec(afterColon);
  if (!blockMatch) return null;

  const prefixLen = (isCompactSeq ? 2 : 0) + colonIdx + 1;
  return {
    prefix: `${withoutComment.slice(0, prefixLen)} `,
    style: blockMatch[1] as "|" | ">",
    chomp: blockMatch[2] as "" | "-" | "+",
  };
}

function foldBlockLines(lines: string[]): string {
  if (lines.length === 0) return "";
  let out = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const curr = lines[i];
    if (prev === "" || curr === "") {
      out += `\n${curr}`;
    } else if (prev.startsWith(" ") || curr.startsWith(" ")) {
      out += `\n${curr}`;
    } else {
      out += ` ${curr}`;
    }
  }
  return out;
}

/**
 * Lexes a YAML document into indentation-aware logical line tokens.
 */
export function tokenizeYamlLines(source: string): YamlLineToken[] {
  if (typeof source !== "string") {
    throw new YamlParseError("YAML syntax error: input must be a string");
  }
  const cleanSource =
    source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const rawLines = cleanSource.replace(/\r\n?/g, "\n").split("\n");
  const tokens: YamlLineToken[] = [];

  for (let idx = 0; idx < rawLines.length; idx++) {
    const lineNum = idx + 1;
    const raw = rawLines[idx];

    let indent = 0;
    while (indent < raw.length && raw[indent] === " ") {
      indent++;
    }
    if (raw[indent] === "\t") {
      throw new YamlParseError(
        `YAML syntax error at line ${lineNum}: tabs are not permitted for indentation`
      );
    }

    const rest = raw.slice(indent);
    if (!rest || rest.startsWith("#")) continue;
    if (indent === 0 && (rest === "---" || rest === "...")) continue;

    let withoutComment: string;
    try {
      withoutComment = stripCommentOutsideQuotes(rest);
    } catch (err) {
      throw new YamlParseError(
        `YAML syntax error at line ${lineNum}: ${(err as Error).message}`
      );
    }

    if (!withoutComment) continue;

    const blockHeader = matchBlockScalarHeader(withoutComment);
    if (blockHeader) {
      const collected: {
        raw: string;
        spaces: number;
        blank: boolean;
        line: number;
      }[] = [];
      let scan = idx + 1;
      while (scan < rawLines.length) {
        const subRaw = rawLines[scan];
        let spaces = 0;
        while (spaces < subRaw.length && subRaw[spaces] === " ") {
          spaces++;
        }
        const blank = spaces === subRaw.length;
        if (!blank && spaces <= indent) {
          break;
        }
        collected.push({ raw: subRaw, spaces, blank, line: scan + 1 });
        scan++;
      }

      const firstContent = collected.find((item) => !item.blank);
      let scalarText = "";
      if (firstContent) {
        const blockIndent = firstContent.spaces;
        const bodyLines: string[] = [];
        for (const item of collected) {
          if (item.blank) {
            bodyLines.push(
              item.spaces > blockIndent ? item.raw.slice(blockIndent) : ""
            );
          } else {
            if (item.spaces < blockIndent) {
              throw new YamlParseError(
                `YAML syntax error at line ${item.line}: inconsistent block scalar indentation`
              );
            }
            if (
              item.raw[spacesIndexBeforeContent(item.raw, blockIndent)] === "\t"
            ) {
              throw new YamlParseError(
                `YAML syntax error at line ${item.line}: tabs are not permitted for block indentation`
              );
            }
            bodyLines.push(item.raw.slice(blockIndent));
          }
        }

        let trailingBlankCount = 0;
        while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") {
          bodyLines.pop();
          trailingBlankCount++;
        }

        const joined =
          blockHeader.style === "|"
            ? bodyLines.join("\n")
            : foldBlockLines(bodyLines);

        if (blockHeader.chomp === "-") {
          scalarText = joined;
        } else if (blockHeader.chomp === "+") {
          scalarText = `${joined}${"\n".repeat(1 + trailingBlankCount)}`;
        } else {
          scalarText = joined.length > 0 ? `${joined}\n` : "";
        }
      }

      tokens.push({
        indent,
        content: `${blockHeader.prefix}${JSON.stringify(scalarText)}`,
        line: lineNum,
      });
      idx = scan - 1;
      continue;
    }

    tokens.push({
      indent,
      content: withoutComment,
      line: lineNum,
    });
  }

  return tokens;
}

function spacesIndexBeforeContent(raw: string, blockIndent: number): number {
  for (let i = 0; i < blockIndent && i < raw.length; i++) {
    if (raw[i] === "\t") return i;
  }
  return -1;
}

function findMappingColon(text: string): number {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inDouble) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inDouble = false;
      }
      continue;
    }
    if (inSingle) {
      if (ch === "'" && text[i + 1] === "'") {
        i++;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (ch === '"') {
      inDouble = true;
    } else if (ch === "'") {
      inSingle = true;
    } else if (ch === "[") {
      bracketDepth++;
    } else if (ch === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (ch === "{") {
      braceDepth++;
    } else if (ch === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (
      ch === ":" &&
      bracketDepth === 0 &&
      braceDepth === 0 &&
      (i === text.length - 1 || text[i + 1] === " ")
    ) {
      return i;
    }
  }
  return -1;
}

function decodeSingleQuotedYaml(
  trimmed: string,
  line: number,
  label: string
): string {
  if (
    !trimmed.startsWith("'") ||
    !trimmed.endsWith("'") ||
    trimmed.length < 2
  ) {
    throw new YamlParseError(
      `YAML syntax error at line ${line}: invalid single-quoted ${label}`
    );
  }
  let out = "";
  for (let i = 1; i < trimmed.length - 1; i++) {
    const ch = trimmed[i];
    if (ch === "'") {
      if (trimmed[i + 1] === "'" && i + 1 < trimmed.length - 1) {
        out += "'";
        i++;
      } else {
        throw new YamlParseError(
          `YAML syntax error at line ${line}: unescaped single quote in ${label}`
        );
      }
    } else {
      out += ch;
    }
  }
  return out;
}

function parseYamlKey(rawKey: string, line: number): string {
  const trimmed = rawKey.trim();
  if (!trimmed) {
    throw new YamlParseError(
      `YAML syntax error at line ${line}: empty mapping key`
    );
  }
  if (trimmed.startsWith('"')) {
    if (!trimmed.endsWith('"') || trimmed.length < 2) {
      throw new YamlParseError(
        `YAML syntax error at line ${line}: invalid double-quoted key`
      );
    }
    try {
      const parsedKey = JSON.parse(trimmed) as unknown;
      if (typeof parsedKey !== "string") {
        throw new Error("Expected string key");
      }
      return parsedKey;
    } catch (err) {
      throw new YamlParseError(
        `YAML syntax error at line ${line}: invalid double-quoted key (${(err as Error).message})`
      );
    }
  }
  if (trimmed.startsWith("'")) {
    return decodeSingleQuotedYaml(trimmed, line, "key");
  }
  return trimmed;
}

function splitFlowItems(inner: string, line: number, depth: number): string[] {
  const trimmed = inner.trim();
  if (!trimmed) return [];

  const parts: string[] = [];
  let start = 0;
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inDouble) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inDouble = false;
      }
      continue;
    }
    if (inSingle) {
      if (ch === "'" && trimmed[i + 1] === "'") {
        i++;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (ch === '"') inDouble = true;
    else if (ch === "'") inSingle = true;
    else if (ch === "[") {
      bracketDepth++;
      if (depth + bracketDepth + braceDepth > MAX_YAML_NESTING_DEPTH) {
        throw new YamlParseError(
          `YAML syntax error at line ${line}: nesting exceeds ${MAX_YAML_NESTING_DEPTH} levels`
        );
      }
    } else if (ch === "]") {
      bracketDepth--;
      if (bracketDepth < 0) {
        throw new YamlParseError(
          `YAML syntax error at line ${line}: unbalanced flow collection delimiters`
        );
      }
    } else if (ch === "{") {
      braceDepth++;
      if (depth + bracketDepth + braceDepth > MAX_YAML_NESTING_DEPTH) {
        throw new YamlParseError(
          `YAML syntax error at line ${line}: nesting exceeds ${MAX_YAML_NESTING_DEPTH} levels`
        );
      }
    } else if (ch === "}") {
      braceDepth--;
      if (braceDepth < 0) {
        throw new YamlParseError(
          `YAML syntax error at line ${line}: unbalanced flow collection delimiters`
        );
      }
    } else if (ch === "," && bracketDepth === 0 && braceDepth === 0) {
      parts.push(trimmed.slice(start, i).trim());
      start = i + 1;
    }
  }

  if (bracketDepth !== 0 || braceDepth !== 0 || inSingle || inDouble) {
    throw new YamlParseError(
      `YAML syntax error at line ${line}: unbalanced flow collection delimiters`
    );
  }

  const tail = trimmed.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function parseInlineValue(
  rawValue: string,
  line: number,
  depth: number
): YamlAstNode {
  if (depth > MAX_YAML_NESTING_DEPTH) {
    throw new YamlParseError(
      `YAML syntax error at line ${line}: nesting exceeds ${MAX_YAML_NESTING_DEPTH} levels`
    );
  }
  const trimmed = rawValue.trim();
  if (trimmed === "[]") {
    return { kind: "sequence", items: [], line };
  }
  if (trimmed === "{}") {
    return { kind: "mapping", entries: [], line };
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1);
    const items = splitFlowItems(inner, line, depth).map((item) =>
      parseInlineValue(item, line, depth + 1)
    );
    return { kind: "sequence", items, line };
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const inner = trimmed.slice(1, -1);
    const entries: YamlAstMappingEntry[] = splitFlowItems(
      inner,
      line,
      depth
    ).map((part) => {
      const colonIdx = findMappingColon(part);
      if (colonIdx === -1) {
        throw new YamlParseError(
          `YAML syntax error at line ${line}: invalid flow mapping entry "${part}"`
        );
      }
      const key = parseYamlKey(part.slice(0, colonIdx), line);
      const val = parseInlineValue(part.slice(colonIdx + 1), line, depth + 1);
      return { key, value: val, line };
    });
    return { kind: "mapping", entries, line };
  }
  if (trimmed.startsWith('"')) {
    if (!trimmed.endsWith('"') || trimmed.length < 2) {
      throw new YamlParseError(
        `YAML syntax error at line ${line}: unterminated double-quoted scalar`
      );
    }
    try {
      const parsedStr = JSON.parse(trimmed) as unknown;
      if (typeof parsedStr !== "string") {
        throw new Error("Expected string");
      }
      return { kind: "scalar", value: parsedStr, line };
    } catch (err) {
      throw new YamlParseError(
        `YAML syntax error at line ${line}: invalid double-quoted string (${(err as Error).message})`
      );
    }
  }
  if (trimmed.startsWith("'")) {
    return {
      kind: "scalar",
      value: decodeSingleQuotedYaml(trimmed, line, "scalar"),
      line,
    };
  }
  if (trimmed === "null" || trimmed === "~") {
    return { kind: "scalar", value: null, line };
  }
  if (trimmed === "true") {
    return { kind: "scalar", value: true, line };
  }
  if (trimmed === "false") {
    return { kind: "scalar", value: false, line };
  }
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (Number.isFinite(num)) {
      return { kind: "scalar", value: num, line };
    }
  }

  return { kind: "scalar", value: trimmed, line };
}

function isSequenceItemContent(content: string): boolean {
  return content === "-" || content.startsWith("- ");
}

/**
 * Parses a YAML string into a typed AST node tree.
 */
export function parseYamlAst(source: string): YamlAstNode {
  const tokens = tokenizeYamlLines(source);
  if (tokens.length === 0) {
    throw new YamlParseError("YAML syntax error: empty document");
  }

  let cursor = 0;

  const parseNode = (expectedIndent: number, depth: number): YamlAstNode => {
    if (depth > MAX_YAML_NESTING_DEPTH) {
      throw new YamlParseError(
        `YAML syntax error: nesting exceeds ${MAX_YAML_NESTING_DEPTH} levels`
      );
    }
    const current = tokens[cursor];
    if (!current) {
      throw new YamlParseError("YAML syntax error: unexpected end of document");
    }

    if (isSequenceItemContent(current.content)) {
      return parseSequence(expectedIndent, depth);
    }
    const colonIdx = findMappingColon(current.content);
    if (colonIdx !== -1) {
      return parseMapping(expectedIndent, depth);
    }

    cursor++;
    return parseInlineValue(current.content, current.line, depth);
  };

  const parseSequence = (
    seqIndent: number,
    depth: number
  ): YamlAstSequenceNode => {
    if (depth > MAX_YAML_NESTING_DEPTH) {
      throw new YamlParseError(
        `YAML syntax error: nesting exceeds ${MAX_YAML_NESTING_DEPTH} levels`
      );
    }
    const startLine = tokens[cursor].line;
    const items: YamlAstNode[] = [];

    while (cursor < tokens.length) {
      const tok = tokens[cursor];
      if (tok.indent < seqIndent) break;
      if (tok.indent > seqIndent) {
        throw new YamlParseError(
          `YAML syntax error at line ${tok.line}: unexpected indentation (${tok.indent} > ${seqIndent})`
        );
      }
      if (!isSequenceItemContent(tok.content)) {
        break;
      }

      const afterDash = tok.content === "-" ? "" : tok.content.slice(2).trim();
      cursor++;

      if (!afterDash) {
        if (cursor < tokens.length && tokens[cursor].indent > seqIndent) {
          items.push(parseNode(tokens[cursor].indent, depth + 1));
        } else {
          items.push({ kind: "scalar", value: null, line: tok.line });
        }
        continue;
      }

      if (isSequenceItemContent(afterDash)) {
        // Nested inline sequence item `- - val`
        const syntheticIndent = tok.indent + 2;
        tokens.splice(cursor, 0, {
          indent: syntheticIndent,
          content: afterDash,
          line: tok.line,
        });
        items.push(parseSequence(syntheticIndent, depth + 1));
        continue;
      }

      const colonIdx = findMappingColon(afterDash);
      if (colonIdx !== -1) {
        // Compact mapping inside sequence item: `- key: val`
        const itemIndent = tok.indent + 2;
        const firstKey = parseYamlKey(afterDash.slice(0, colonIdx), tok.line);
        const firstRest = afterDash.slice(colonIdx + 1).trim();
        let firstVal: YamlAstNode;

        if (firstRest) {
          firstVal = parseInlineValue(firstRest, tok.line, depth + 1);
        } else if (
          cursor < tokens.length &&
          tokens[cursor].indent > itemIndent
        ) {
          firstVal = parseNode(tokens[cursor].indent, depth + 2);
        } else if (
          cursor < tokens.length &&
          tokens[cursor].indent === itemIndent &&
          isSequenceItemContent(tokens[cursor].content)
        ) {
          firstVal = parseSequence(itemIndent, depth + 2);
        } else {
          firstVal = { kind: "scalar", value: null, line: tok.line };
        }

        const entries: YamlAstMappingEntry[] = [
          { key: firstKey, value: firstVal, line: tok.line },
        ];

        if (cursor < tokens.length && tokens[cursor].indent === itemIndent) {
          const restMap = parseMapping(itemIndent, depth + 1);
          for (const entry of restMap.entries) {
            if (entry.key === firstKey) {
              throw new YamlParseError(
                `YAML syntax error at line ${entry.line}: duplicate mapping key "${entry.key}"`
              );
            }
            entries.push(entry);
          }
        } else if (
          cursor < tokens.length &&
          tokens[cursor].indent > seqIndent &&
          tokens[cursor].indent !== itemIndent
        ) {
          throw new YamlParseError(
            `YAML syntax error at line ${tokens[cursor].line}: inconsistent indentation in sequence mapping`
          );
        }

        items.push({ kind: "mapping", entries, line: tok.line });
        continue;
      }

      items.push(parseInlineValue(afterDash, tok.line, depth + 1));
    }

    return { kind: "sequence", items, line: startLine };
  };

  const parseMapping = (
    mapIndent: number,
    depth: number
  ): YamlAstMappingNode => {
    if (depth > MAX_YAML_NESTING_DEPTH) {
      throw new YamlParseError(
        `YAML syntax error: nesting exceeds ${MAX_YAML_NESTING_DEPTH} levels`
      );
    }
    const startLine = tokens[cursor].line;
    const entries: YamlAstMappingEntry[] = [];
    const seenKeys = new Set<string>();

    while (cursor < tokens.length) {
      const tok = tokens[cursor];
      if (tok.indent < mapIndent) break;
      if (tok.indent > mapIndent) {
        throw new YamlParseError(
          `YAML syntax error at line ${tok.line}: unexpected indentation (${tok.indent} > ${mapIndent})`
        );
      }
      if (isSequenceItemContent(tok.content)) {
        break;
      }

      const colonIdx = findMappingColon(tok.content);
      if (colonIdx === -1) {
        throw new YamlParseError(
          `YAML syntax error at line ${tok.line}: expected "key: value" mapping entry`
        );
      }

      const key = parseYamlKey(tok.content.slice(0, colonIdx), tok.line);
      if (seenKeys.has(key)) {
        throw new YamlParseError(
          `YAML syntax error at line ${tok.line}: duplicate mapping key "${key}"`
        );
      }
      seenKeys.add(key);

      const rest = tok.content.slice(colonIdx + 1).trim();
      cursor++;

      let value: YamlAstNode;
      if (rest) {
        if (rest === "|" || rest === ">") {
          throw new YamlParseError(
            `YAML syntax error at line ${tok.line}: block chomping scalars ("${rest}") are not supported in Universal CRF YAML; use quoted strings`
          );
        }
        value = parseInlineValue(rest, tok.line, depth + 1);
      } else if (cursor < tokens.length && tokens[cursor].indent > mapIndent) {
        value = parseNode(tokens[cursor].indent, depth + 1);
      } else if (
        cursor < tokens.length &&
        tokens[cursor].indent === mapIndent &&
        isSequenceItemContent(tokens[cursor].content)
      ) {
        value = parseSequence(mapIndent, depth + 1);
      } else {
        value = { kind: "scalar", value: null, line: tok.line };
      }

      entries.push({ key, value, line: tok.line });
    }

    return { kind: "mapping", entries, line: startLine };
  };

  const root = parseNode(tokens[0].indent, 0);
  if (cursor < tokens.length) {
    const leftover = tokens[cursor];
    throw new YamlParseError(
      `YAML syntax error at line ${leftover.line}: unexpected trailing content`
    );
  }
  return root;
}

/**
 * Evaluates a `YamlAstNode` into plain JavaScript values without prototype pollution.
 */
export function evaluateYamlAst(node: YamlAstNode): unknown {
  switch (node.kind) {
    case "scalar":
      return node.value;
    case "sequence":
      return node.items.map((item) => evaluateYamlAst(item));
    case "mapping": {
      const obj: Record<string, unknown> = {};
      for (const entry of node.entries) {
        if (
          entry.key === "__proto__" ||
          entry.key === "constructor" ||
          entry.key === "prototype"
        ) {
          continue;
        }
        obj[entry.key] = evaluateYamlAst(entry.value);
      }
      return obj;
    }
  }
}

/**
 * Parses a YAML string into a JavaScript value via `parseYamlAst`.
 */
export function parseYaml(source: string): unknown {
  return evaluateYamlAst(parseYamlAst(source));
}
