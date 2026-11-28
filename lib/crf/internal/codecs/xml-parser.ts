/**
 * Pure zero-dependency XML 1.0 tokenizer and element tree parser for CDISC ODM-XML v1.3.2.
 * Runs identically in Node.js and browsers without `DOMParser` or external XML packages.
 */

export interface XmlTextNode {
  readonly kind: "text";
  readonly value: string;
}

export interface XmlElementNode {
  readonly kind: "element";
  readonly tagName: string;
  readonly prefix: string;
  readonly localName: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly XmlNode[];
}

export type XmlNode = XmlElementNode | XmlTextNode;

export interface XmlDocumentNode {
  readonly root: XmlElementNode;
}

/**
 * Maximum element nesting depth accepted by `parseXmlDocument`.
 */
export const MAX_XML_DEPTH = 64;

/**
 * Typed syntax and well-formedness error raised by `parseXmlDocument` and `decodeXmlEntities`.
 */
export class XmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmlParseError";
  }
}

/**
 * Decodes XML 1.0 predefined and numeric character references in a single pass,
 * ensuring `&amp;lt;` decodes to literal `&lt;` without double-unescaping.
 */
export function decodeXmlEntities(raw: string): string {
  if (!raw.includes("&")) return raw;

  return raw.replace(
    /&(?:#(\d+);|#x([0-9a-fA-F]+);|(lt|gt|amp|quot|apos);|([^;\s]*;?))/g,
    (full, decDigits, hexDigits, named) => {
      if (named) {
        switch (named) {
          case "lt":
            return "<";
          case "gt":
            return ">";
          case "amp":
            return "&";
          case "quot":
            return '"';
          case "apos":
            return "'";
          default:
            return full;
        }
      }
      if (!decDigits && !hexDigits) {
        throw new XmlParseError(
          `Invalid or undeclared XML entity reference "${full}"`
        );
      }
      const codePoint = decDigits
        ? parseInt(decDigits, 10)
        : parseInt(hexDigits, 16);
      if (
        !Number.isFinite(codePoint) ||
        codePoint <= 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        throw new XmlParseError(
          `Invalid XML numeric character reference "${full}"`
        );
      }
      return String.fromCodePoint(codePoint);
    }
  );
}

function splitQualifiedName(qName: string): {
  prefix: string;
  localName: string;
} {
  const colonIdx = qName.indexOf(":");
  if (colonIdx === -1) {
    return { prefix: "", localName: qName };
  }
  return {
    prefix: qName.slice(0, colonIdx),
    localName: qName.slice(colonIdx + 1),
  };
}

function isNameStartChar(ch: string): boolean {
  return /[A-Za-z_:]/.test(ch) || ch.charCodeAt(0) >= 0xc0;
}

function isNameChar(ch: string): boolean {
  return /[A-Za-z0-9_:.-]/.test(ch) || ch.charCodeAt(0) >= 0xb7;
}

/**
 * Parses a well-formed XML 1.0 document string into an `XmlDocumentNode`.
 * Rejects malformed markup, mismatched tags, unescaped `<` in attributes, and DTD `<!ENTITY` declarations.
 */
export function parseXmlDocument(xmlInput: string): XmlDocumentNode {
  if (!xmlInput || typeof xmlInput !== "string") {
    throw new XmlParseError("Empty XML document");
  }
  const src = xmlInput.charCodeAt(0) === 0xfeff ? xmlInput.slice(1) : xmlInput;
  const len = src.length;
  let pos = 0;

  const stack: Array<{
    tagName: string;
    prefix: string;
    localName: string;
    attributes: Record<string, string>;
    children: XmlNode[];
  }> = [];
  let rootElement: XmlElementNode | null = null;

  const skipWhitespace = () => {
    while (pos < len && /\s/.test(src[pos])) pos++;
  };

  const readName = (): string => {
    if (pos >= len || !isNameStartChar(src[pos])) {
      throw new XmlParseError(`Expected XML name at offset ${pos}`);
    }
    const start = pos;
    pos++;
    while (pos < len && isNameChar(src[pos])) pos++;
    const name = src.slice(start, pos);
    if (
      name.startsWith(":") ||
      name.endsWith(":") ||
      name.indexOf(":") !== name.lastIndexOf(":")
    ) {
      throw new XmlParseError(`Invalid XML qualified name "${name}"`);
    }
    return name;
  };

  while (pos < len) {
    const ltIdx = src.indexOf("<", pos);
    if (ltIdx === -1) {
      const trailing = src.slice(pos);
      if (stack.length > 0) {
        throw new XmlParseError(
          `Unclosed XML element <${stack[stack.length - 1].tagName}>`
        );
      }
      if (trailing.trim().length > 0) {
        throw new XmlParseError("Unexpected text outside root XML element");
      }
      break;
    }

    if (ltIdx > pos) {
      const rawText = src.slice(pos, ltIdx);
      if (rawText.includes("]]>")) {
        throw new XmlParseError('Unexpected "]]>" in XML character data');
      }
      if (stack.length === 0) {
        if (rawText.trim().length > 0) {
          throw new XmlParseError("Unexpected text before root XML element");
        }
      } else {
        const decoded = decodeXmlEntities(rawText);
        stack[stack.length - 1].children.push({
          kind: "text",
          value: decoded,
        });
      }
      pos = ltIdx;
    }

    // Now src[pos] === '<'
    if (src.startsWith("<!--", pos)) {
      const endComment = src.indexOf("-->", pos + 4);
      if (endComment === -1) {
        throw new XmlParseError("Unterminated XML comment");
      }
      const commentBody = src.slice(pos + 4, endComment);
      if (commentBody.includes("--")) {
        throw new XmlParseError('Invalid "--" inside XML comment');
      }
      pos = endComment + 3;
      continue;
    }

    if (src.startsWith("<![CDATA[", pos)) {
      if (stack.length === 0) {
        throw new XmlParseError(
          "CDATA section is not allowed outside root element"
        );
      }
      const endCdata = src.indexOf("]]>", pos + 9);
      if (endCdata === -1) {
        throw new XmlParseError("Unterminated CDATA section");
      }
      const cdataText = src.slice(pos + 9, endCdata);
      stack[stack.length - 1].children.push({
        kind: "text",
        value: cdataText,
      });
      pos = endCdata + 3;
      continue;
    }

    if (src.startsWith("<?", pos)) {
      const endPi = src.indexOf("?>", pos + 2);
      if (endPi === -1) {
        throw new XmlParseError("Unterminated XML processing instruction");
      }
      pos = endPi + 2;
      continue;
    }

    if (src.startsWith("<!DOCTYPE", pos)) {
      if (stack.length > 0 || rootElement !== null) {
        throw new XmlParseError("Misplaced <!DOCTYPE> declaration");
      }
      let depth = 0;
      let inQuote: string | null = null;
      let cursor = pos + 9;
      while (cursor < len) {
        const ch = src[cursor];
        if (inQuote) {
          if (ch === inQuote) inQuote = null;
        } else if (ch === '"' || ch === "'") {
          inQuote = ch;
        } else if (ch === "[") {
          depth++;
        } else if (ch === "]") {
          if (depth === 0) {
            throw new XmlParseError('Unexpected "]" in <!DOCTYPE> declaration');
          }
          depth--;
        } else if (ch === ">" && depth === 0) {
          break;
        }
        cursor++;
      }
      if (cursor >= len) {
        throw new XmlParseError("Unterminated <!DOCTYPE> declaration");
      }
      const doctypeSlice = src.slice(pos, cursor + 1);
      if (/<!ENTITY\b/i.test(doctypeSlice)) {
        throw new XmlParseError(
          "XML DTD <!ENTITY> declarations are forbidden for security"
        );
      }
      pos = cursor + 1;
      continue;
    }

    if (src.startsWith("</", pos)) {
      pos += 2;
      const closeName = readName();
      skipWhitespace();
      if (pos >= len || src[pos] !== ">") {
        throw new XmlParseError(`Expected ">" in closing tag </${closeName}>`);
      }
      pos++;
      if (stack.length === 0) {
        throw new XmlParseError(`Unexpected closing tag </${closeName}>`);
      }
      const popped = stack.pop()!;
      if (popped.tagName !== closeName) {
        throw new XmlParseError(
          `Mismatched XML closing tag </${closeName}>; expected </${popped.tagName}>`
        );
      }
      const completed: XmlElementNode = {
        kind: "element",
        tagName: popped.tagName,
        prefix: popped.prefix,
        localName: popped.localName,
        attributes: popped.attributes,
        children: popped.children,
      };
      if (stack.length === 0) {
        rootElement = completed;
      } else {
        stack[stack.length - 1].children.push(completed);
      }
      continue;
    }

    // Opening or self-closing element `<Tag ...>`
    if (rootElement !== null && stack.length === 0) {
      throw new XmlParseError("Multiple root elements in XML document");
    }
    pos++; // consume `<`
    const tagName = readName();
    const { prefix, localName } = splitQualifiedName(tagName);
    const attributes: Record<string, string> = {};
    let selfClosing = false;

    while (pos < len) {
      const beforeWs = pos;
      skipWhitespace();
      if (pos >= len) {
        throw new XmlParseError(`Unterminated opening tag <${tagName}>`);
      }
      if (src[pos] === ">") {
        pos++;
        break;
      }
      if (src.startsWith("/>", pos)) {
        selfClosing = true;
        pos += 2;
        break;
      }
      if (pos === beforeWs) {
        throw new XmlParseError(
          `Expected whitespace between attributes in <${tagName}>`
        );
      }

      const attrName = readName();
      if (
        attrName === "__proto__" ||
        attrName === "constructor" ||
        attrName === "prototype"
      ) {
        throw new XmlParseError(`Disallowed attribute name "${attrName}"`);
      }
      if (Object.prototype.hasOwnProperty.call(attributes, attrName)) {
        throw new XmlParseError(
          `Duplicate XML attribute "${attrName}" on <${tagName}>`
        );
      }
      skipWhitespace();
      if (pos >= len || src[pos] !== "=") {
        throw new XmlParseError(
          `Expected "=" after attribute "${attrName}" on <${tagName}>`
        );
      }
      pos++;
      skipWhitespace();
      if (pos >= len || (src[pos] !== '"' && src[pos] !== "'")) {
        throw new XmlParseError(
          `Expected quoted value for attribute "${attrName}" on <${tagName}>`
        );
      }
      const quoteChar = src[pos];
      pos++;
      const valStart = pos;
      const valEnd = src.indexOf(quoteChar, valStart);
      if (valEnd === -1) {
        throw new XmlParseError(
          `Unterminated attribute "${attrName}" on <${tagName}>`
        );
      }
      const rawAttrVal = src.slice(valStart, valEnd);
      if (rawAttrVal.includes("<")) {
        throw new XmlParseError(
          `Unescaped "<" in attribute "${attrName}" on <${tagName}>`
        );
      }
      attributes[attrName] = decodeXmlEntities(rawAttrVal);
      pos = valEnd + 1;
    }

    if (stack.length >= MAX_XML_DEPTH) {
      throw new XmlParseError(`XML nesting exceeds ${MAX_XML_DEPTH} levels`);
    }

    if (selfClosing) {
      const node: XmlElementNode = {
        kind: "element",
        tagName,
        prefix,
        localName,
        attributes,
        children: [],
      };
      if (stack.length === 0) {
        rootElement = node;
      } else {
        stack[stack.length - 1].children.push(node);
      }
    } else {
      stack.push({
        tagName,
        prefix,
        localName,
        attributes,
        children: [],
      });
    }
  }

  if (stack.length > 0) {
    throw new XmlParseError(
      `Unclosed XML element <${stack[stack.length - 1].tagName}>`
    );
  }
  if (!rootElement) {
    throw new XmlParseError("Empty XML document: missing root element");
  }

  return { root: rootElement };
}

/**
 * Returns an attribute value from an `XmlElementNode`, or `undefined` when absent.
 */
export function getXmlAttribute(
  el: XmlElementNode,
  name: string
): string | undefined {
  return Object.prototype.hasOwnProperty.call(el.attributes, name)
    ? el.attributes[name]
    : undefined;
}

/**
 * Concatenates all descendant text content inside an `XmlElementNode`.
 */
export function getXmlTextContent(el: XmlElementNode): string {
  let out = "";
  for (const child of el.children) {
    if (child.kind === "text") {
      out += child.value;
    } else {
      out += getXmlTextContent(child);
    }
  }
  return out;
}

/**
 * Returns direct child elements of `parent`, optionally filtered by case-insensitive `localName`.
 */
export function getDirectChildElements(
  parent: XmlElementNode,
  localName?: string
): XmlElementNode[] {
  const target = localName?.toLowerCase();
  const out: XmlElementNode[] = [];
  for (const child of parent.children) {
    if (child.kind === "element") {
      if (!target || child.localName.toLowerCase() === target) {
        out.push(child);
      }
    }
  }
  return out;
}

/**
 * Queries all descendant elements matching `localName` (case-insensitive) in document order.
 */
export function queryElementsByLocalName(
  root: XmlElementNode | XmlDocumentNode,
  localName: string
): XmlElementNode[] {
  const target = localName.toLowerCase();
  const results: XmlElementNode[] = [];
  const startNode = "root" in root ? root.root : root;

  const visit = (el: XmlElementNode, includeSelf: boolean) => {
    if (includeSelf && el.localName.toLowerCase() === target) {
      results.push(el);
    }
    for (const child of el.children) {
      if (child.kind === "element") {
        visit(child, true);
      }
    }
  };

  visit(startNode, "root" in root);
  return results;
}

/**
 * Returns trimmed text content of the first descendant element matching `localName`.
 */
export function getFirstChildText(
  parent: XmlElementNode,
  localName: string
): string {
  const matches = queryElementsByLocalName(parent, localName);
  return matches.length > 0 ? getXmlTextContent(matches[0]).trim() : "";
}
