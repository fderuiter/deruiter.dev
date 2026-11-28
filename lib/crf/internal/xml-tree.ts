/**
 * Pure, zero-DOM XML 1.0 tree parser for CDISC ODM-XML ingestion.
 *
 * Scans XML source text directly into plain TypeScript element records without
 * invoking `DOMParser` or constructing browser/HTML DOM nodes, so user-supplied
 * file and textarea strings remain inert data throughout parsing and never pass
 * through an HTML/DOM reinterpretation sink.
 *
 * Security and well-formedness properties:
 * - Decodes predefined XML entities (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&apos;`)
 *   and numeric character references (`&#...;`, `&#x...;`) in a single pass,
 *   preventing double-unescaping (`&amp;lt;` decodes to `&lt;`, never `<`).
 * - Stores attributes in a `Map` rather than a plain object so attribute names
 *   such as `constructor` or `__proto__` never collide with `Object.prototype`.
 * - Rejects `<!ENTITY` declarations to block external/internal entity expansion.
 * - Enforces balanced start/end tags, quoted attributes, duplicate-attribute
 *   rejection, and single root element structure.
 */

const XML_NAMED_ENTITIES: Readonly<Record<string, string>> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
};

/** Read-only plain data representation of an XML element. */
export interface XmlElementNode {
  readonly qName: string;
  readonly localName: string;
  readonly children: readonly XmlElementNode[];
  readonly textContent: string;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
}

/** Read-only plain data representation of an XML document. */
export interface XmlDocumentNode {
  readonly root: XmlElementNode;
  readonly children: readonly XmlElementNode[];
}

interface MutableFrame {
  qName: string;
  localName: string;
  attributes: ReadonlyMap<string, string>;
  children: XmlElementNode[];
  textParts: string[];
}

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isNameStartChar(code: number): boolean {
  return (
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) || // a-z
    code === 0x5f || // _
    code === 0x3a || // :
    code >= 0xc0
  );
}

function isNameChar(code: number): boolean {
  return (
    isNameStartChar(code) ||
    (code >= 0x30 && code <= 0x39) || // 0-9
    code === 0x2d || // -
    code === 0x2e || // .
    code === 0xb7
  );
}

function extractLocalName(qName: string): string {
  const colonIdx = qName.indexOf(":");
  if (colonIdx === -1) return qName;
  if (
    colonIdx === 0 ||
    colonIdx === qName.length - 1 ||
    qName.indexOf(":", colonIdx + 1) !== -1
  ) {
    throw new Error(
      `Invalid CDISC ODM XML structure: Malformed qualified name "${qName}"`
    );
  }
  return qName.slice(colonIdx + 1);
}

/**
 * Decodes XML character and predefined entity references in a single pass.
 * Throws on bare `&` or unrecognized entity names per XML 1.0 well-formedness.
 */
export function decodeXmlEntities(raw: string): string {
  if (!raw.includes("&")) return raw;

  let out = "";
  let i = 0;
  while (i < raw.length) {
    const amp = raw.indexOf("&", i);
    if (amp === -1) {
      out += raw.slice(i);
      break;
    }
    if (amp > i) {
      out += raw.slice(i, amp);
    }
    const semi = raw.indexOf(";", amp + 1);
    if (semi === -1) {
      throw new Error(
        "Invalid CDISC ODM XML structure: Unterminated entity reference"
      );
    }
    const body = raw.slice(amp + 1, semi);
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const hex = body.slice(2);
      if (!/^[0-9a-fA-F]+$/.test(hex)) {
        throw new Error(
          `Invalid CDISC ODM XML structure: Invalid hex character reference "&${body};"`
        );
      }
      const codePoint = Number.parseInt(hex, 16);
      if (
        !Number.isFinite(codePoint) ||
        codePoint <= 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        throw new Error(
          `Invalid CDISC ODM XML structure: Out-of-range character reference "&${body};"`
        );
      }
      out += String.fromCodePoint(codePoint);
    } else if (body.startsWith("#")) {
      const dec = body.slice(1);
      if (!/^\d+$/.test(dec)) {
        throw new Error(
          `Invalid CDISC ODM XML structure: Invalid decimal character reference "&${body};"`
        );
      }
      const codePoint = Number.parseInt(dec, 10);
      if (
        !Number.isFinite(codePoint) ||
        codePoint <= 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        throw new Error(
          `Invalid CDISC ODM XML structure: Out-of-range character reference "&${body};"`
        );
      }
      out += String.fromCodePoint(codePoint);
    } else {
      const replacement = Object.prototype.hasOwnProperty.call(
        XML_NAMED_ENTITIES,
        body
      )
        ? XML_NAMED_ENTITIES[body]
        : undefined;
      if (replacement === undefined) {
        throw new Error(
          `Invalid CDISC ODM XML structure: Unknown XML entity "&${body};"`
        );
      }
      out += replacement;
    }
    i = semi + 1;
  }
  return out;
}

function finalizeNode(frame: MutableFrame): XmlElementNode {
  const attrs = frame.attributes;
  return {
    qName: frame.qName,
    localName: frame.localName,
    children: frame.children,
    textContent: frame.textParts.join(""),
    getAttribute(name: string): string | null {
      const val = attrs.get(name);
      return val === undefined ? null : val;
    },
    hasAttribute(name: string): boolean {
      return attrs.has(name);
    },
  };
}

function skipWhitespace(src: string, start: number): number {
  let pos = start;
  while (pos < src.length && isWhitespace(src[pos])) {
    pos += 1;
  }
  return pos;
}

function readXmlName(
  src: string,
  start: number
): { name: string; end: number } {
  if (start >= src.length || !isNameStartChar(src.charCodeAt(start))) {
    throw new Error(
      "Invalid CDISC ODM XML structure: Expected valid XML tag or attribute name"
    );
  }
  let end = start + 1;
  while (end < src.length && isNameChar(src.charCodeAt(end))) {
    end += 1;
  }
  return { name: src.slice(start, end), end };
}

function skipDoctype(src: string, start: number): number {
  let pos = start + "<!DOCTYPE".length;
  if (pos >= src.length || !isWhitespace(src[pos])) {
    throw new Error(
      "Invalid CDISC ODM XML structure: Malformed DOCTYPE declaration"
    );
  }
  let bracketDepth = 0;
  let quote: string | null = null;
  while (pos < src.length) {
    const ch = src[pos];
    if (quote !== null) {
      if (ch === quote) quote = null;
      pos += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      pos += 1;
      continue;
    }
    if (ch === "<" && src.slice(pos, pos + 8).toUpperCase() === "<!ENTITY") {
      throw new Error(
        "Invalid CDISC ODM XML structure: XML ENTITY declarations are not permitted"
      );
    }
    if (ch === "[") {
      bracketDepth += 1;
    } else if (ch === "]") {
      if (bracketDepth === 0) {
        throw new Error(
          "Invalid CDISC ODM XML structure: Unmatched ']' in DOCTYPE"
        );
      }
      bracketDepth -= 1;
    } else if (ch === ">" && bracketDepth === 0) {
      return pos + 1;
    }
    pos += 1;
  }
  throw new Error(
    "Invalid CDISC ODM XML structure: Unterminated DOCTYPE declaration"
  );
}

/**
 * Parses a well-formed XML 1.0 string into a plain {@link XmlDocumentNode}.
 */
export function parseXmlDocument(xmlSource: string): XmlDocumentNode {
  const src =
    xmlSource.charCodeAt(0) === 0xfeff ? xmlSource.slice(1) : xmlSource;
  const len = src.length;
  let pos = 0;
  const stack: MutableFrame[] = [];
  let root: XmlElementNode | null = null;

  while (pos < len) {
    const ltIdx = src.indexOf("<", pos);
    if (ltIdx === -1) {
      const trailing = src.slice(pos);
      if (stack.length > 0) {
        stack[stack.length - 1].textParts.push(decodeXmlEntities(trailing));
      } else if (trailing.trim().length > 0) {
        throw new Error(
          "Invalid CDISC ODM XML structure: Unexpected text outside root element"
        );
      }
      pos = len;
      break;
    }

    if (ltIdx > pos) {
      const segment = src.slice(pos, ltIdx);
      if (segment.includes("]]>")) {
        throw new Error(
          "Invalid CDISC ODM XML structure: Unexpected ']]>' in character data"
        );
      }
      if (stack.length > 0) {
        stack[stack.length - 1].textParts.push(decodeXmlEntities(segment));
      } else if (segment.trim().length > 0) {
        throw new Error(
          "Invalid CDISC ODM XML structure: Unexpected text outside root element"
        );
      }
      pos = ltIdx;
    }

    // Processing instruction or XML prolog: <? ... ?>
    if (src.startsWith("<?", pos)) {
      const endPi = src.indexOf("?>", pos + 2);
      if (endPi === -1) {
        throw new Error(
          "Invalid CDISC ODM XML structure: Unterminated processing instruction"
        );
      }
      pos = endPi + 2;
      continue;
    }

    // XML comment: <!-- ... -->
    if (src.startsWith("<!--", pos)) {
      const endComment = src.indexOf("-->", pos + 4);
      if (endComment === -1) {
        throw new Error(
          "Invalid CDISC ODM XML structure: Unterminated XML comment"
        );
      }
      pos = endComment + 3;
      continue;
    }

    // CDATA section: <![CDATA[ ... ]]>
    if (src.startsWith("<![CDATA[", pos)) {
      if (stack.length === 0) {
        throw new Error(
          "Invalid CDISC ODM XML structure: CDATA section outside root element"
        );
      }
      const endCdata = src.indexOf("]]>", pos + 9);
      if (endCdata === -1) {
        throw new Error(
          "Invalid CDISC ODM XML structure: Unterminated CDATA section"
        );
      }
      stack[stack.length - 1].textParts.push(src.slice(pos + 9, endCdata));
      pos = endCdata + 3;
      continue;
    }

    // DOCTYPE or prohibited <!ENTITY
    if (src.startsWith("<!", pos)) {
      if (
        stack.length === 0 &&
        root === null &&
        src.slice(pos, pos + 9).toUpperCase() === "<!DOCTYPE"
      ) {
        pos = skipDoctype(src, pos);
        continue;
      }
      throw new Error(
        "Invalid CDISC ODM XML structure: Unsupported or misplaced XML declaration"
      );
    }

    // Closing tag: </QName>
    if (src.startsWith("</", pos)) {
      const { name: closeQName, end: afterName } = readXmlName(src, pos + 2);
      const afterWs = skipWhitespace(src, afterName);
      if (afterWs >= len || src[afterWs] !== ">") {
        throw new Error(
          `Invalid CDISC ODM XML structure: Malformed closing tag </${closeQName}>`
        );
      }
      const top = stack.pop();
      if (!top || top.qName !== closeQName) {
        throw new Error(
          top
            ? `Invalid CDISC ODM XML structure: Expected closing tag </${top.qName}>, found </${closeQName}>`
            : `Invalid CDISC ODM XML structure: Unexpected closing tag </${closeQName}>`
        );
      }
      const node = finalizeNode(top);
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        parent.children.push(node);
        if (node.textContent) {
          parent.textParts.push(node.textContent);
        }
      } else {
        root = node;
      }
      pos = afterWs + 1;
      continue;
    }

    // Opening or self-closing tag: <QName ...> or <QName .../>
    if (root !== null && stack.length === 0) {
      throw new Error(
        "Invalid CDISC ODM XML structure: Multiple root elements are not permitted"
      );
    }

    const { name: openQName, end: afterOpenName } = readXmlName(src, pos + 1);
    const localName = extractLocalName(openQName);
    const attributes = new Map<string, string>();
    let cursor = afterOpenName;
    let selfClosing = false;

    while (true) {
      const wsStart = cursor;
      cursor = skipWhitespace(src, cursor);
      if (cursor >= len) {
        throw new Error(
          `Invalid CDISC ODM XML structure: Unterminated opening tag <${openQName}>`
        );
      }
      if (src.startsWith("/>", cursor)) {
        selfClosing = true;
        cursor += 2;
        break;
      }
      if (src[cursor] === ">") {
        cursor += 1;
        break;
      }
      if (cursor === wsStart) {
        throw new Error(
          `Invalid CDISC ODM XML structure: Missing whitespace before attribute in <${openQName}>`
        );
      }

      const { name: attrName, end: afterAttrName } = readXmlName(src, cursor);
      extractLocalName(attrName);
      if (attributes.has(attrName)) {
        throw new Error(
          `Invalid CDISC ODM XML structure: Duplicate attribute "${attrName}" on <${openQName}>`
        );
      }
      cursor = skipWhitespace(src, afterAttrName);
      if (cursor >= len || src[cursor] !== "=") {
        throw new Error(
          `Invalid CDISC ODM XML structure: Expected '=' after attribute "${attrName}"`
        );
      }
      cursor = skipWhitespace(src, cursor + 1);
      const quote = src[cursor];
      if (quote !== '"' && quote !== "'") {
        throw new Error(
          `Invalid CDISC ODM XML structure: Attribute "${attrName}" must have a quoted value`
        );
      }
      const valStart = cursor + 1;
      const valEnd = src.indexOf(quote, valStart);
      if (valEnd === -1) {
        throw new Error(
          `Invalid CDISC ODM XML structure: Unterminated attribute "${attrName}" on <${openQName}>`
        );
      }
      const rawAttrVal = src.slice(valStart, valEnd);
      if (rawAttrVal.includes("<")) {
        throw new Error(
          `Invalid CDISC ODM XML structure: Unescaped '<' in attribute "${attrName}"`
        );
      }
      attributes.set(attrName, decodeXmlEntities(rawAttrVal));
      cursor = valEnd + 1;
    }

    const frame: MutableFrame = {
      qName: openQName,
      localName,
      attributes,
      children: [],
      textParts: [],
    };

    if (selfClosing) {
      const node = finalizeNode(frame);
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        root = node;
      }
    } else {
      stack.push(frame);
    }
    pos = cursor;
  }

  if (stack.length > 0) {
    throw new Error(
      `Invalid CDISC ODM XML structure: Unclosed element <${stack[stack.length - 1].qName}>`
    );
  }
  if (!root) {
    throw new Error("Invalid CDISC ODM XML structure: Empty XML document");
  }

  return {
    root,
    children: [root],
  };
}
