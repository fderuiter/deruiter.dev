import { ASTNode, NodeType } from "./types";

export class ParseError extends Error {
  column: number;
  line: number;
  formattedMessage: string;

  constructor(
    message: string,
    column: number,
    line: number = 1,
    input?: string
  ) {
    let formatted = `Syntax error at column ${column}: ${message}`;
    if (input) {
      const pointer = " ".repeat(Math.max(0, column - 1)) + "^";
      formatted += `\n${input}\n${pointer}`;
    }
    super(formatted);
    this.name = "ParseError";
    this.column = column;
    this.line = line;
    this.formattedMessage = formatted;
  }
}

export type TokenType =
  | "NUMBER"
  | "BOOLEAN"
  | "IDENTIFIER"
  | "OPERATOR"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  column: number;
}

let nodeCounter = 0;

export function resetNodeCounter(): void {
  nodeCounter = 0;
}

function generateId(prefix = "parsed"): string {
  nodeCounter += 1;
  return `${prefix}-${nodeCounter}`;
}

export function tokenizeFormula(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    const col = i + 1; // 1-based column position

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Number literals (e.g. 2, 10, 3.14)
    if (/[0-9]/.test(char)) {
      let numStr = "";
      const startCol = col;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        numStr += input[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value: numStr, column: startCol });
      continue;
    }

    // Identifiers & Keywords (e.g. a, b, P, Q, σ, true, false)
    if (/[a-zA-Z_σ]/.test(char)) {
      let ident = "";
      const startCol = col;
      while (i < input.length && /[a-zA-Z0-9_σ]/.test(input[i])) {
        ident += input[i];
        i++;
      }
      if (ident === "true" || ident === "false") {
        tokens.push({ type: "BOOLEAN", value: ident, column: startCol });
      } else if (ident === "forall" || ident === "exists") {
        // ASCII spellings of the quantifiers (#2091).
        tokens.push({
          type: "OPERATOR",
          value: ident === "forall" ? "∀" : "∃",
          column: startCol,
        });
      } else {
        tokens.push({ type: "IDENTIFIER", value: ident, column: startCol });
      }
      continue;
    }

    // Parentheses
    if (char === "(") {
      tokens.push({ type: "LPAREN", value: "(", column: col });
      i++;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "RPAREN", value: ")", column: col });
      i++;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "COMMA", value: ",", column: col });
      i++;
      continue;
    }

    // Multi-char operators
    const next2 = input.slice(i, i + 2);
    if (
      next2 === "->" ||
      next2 === "!=" ||
      next2 === "<=" ||
      next2 === ">=" ||
      next2 === "/\\" ||
      next2 === "\\/"
    ) {
      tokens.push({ type: "OPERATOR", value: next2, column: col });
      i += 2;
      continue;
    }

    // Single-char operators and symbols: +, -, *, /, ^, ×, =, ≠, →, ∧, ∨, ~, ¬, !
    if (
      [
        "+",
        "-",
        "*",
        "/",
        "^",
        "×",
        "=",
        "≠",
        "→",
        "∧",
        "∨",
        "~",
        "¬",
        "!",
        "≤",
        "≥",
        "<",
        ">",
        "∀",
        "∃",
      ].includes(char)
    ) {
      tokens.push({ type: "OPERATOR", value: char, column: col });
      i++;
      continue;
    }

    throw new ParseError(`Unexpected character '${char}'`, col, 1, input);
  }

  tokens.push({ type: "EOF", value: "", column: input.length + 1 });
  return tokens;
}

interface OpDef {
  precedence: number;
  associativity: "left" | "right";
  nodeType: NodeType;
  canonicalValue: string;
}

const BINARY_OPERATORS: Record<string, OpDef> = {
  "->": {
    precedence: 10,
    associativity: "right",
    nodeType: "Implication",
    canonicalValue: "→",
  },
  "→": {
    precedence: 10,
    associativity: "right",
    nodeType: "Implication",
    canonicalValue: "→",
  },
  "\\/": {
    precedence: 20,
    associativity: "left",
    nodeType: "Disjunction",
    canonicalValue: "∨",
  },
  "∨": {
    precedence: 20,
    associativity: "left",
    nodeType: "Disjunction",
    canonicalValue: "∨",
  },
  "/\\": {
    precedence: 30,
    associativity: "left",
    nodeType: "Conjunction",
    canonicalValue: "∧",
  },
  "∧": {
    precedence: 30,
    associativity: "left",
    nodeType: "Conjunction",
    canonicalValue: "∧",
  },
  "=": {
    precedence: 40,
    associativity: "left",
    nodeType: "Equality",
    canonicalValue: "=",
  },
  "≠": {
    precedence: 40,
    associativity: "left",
    nodeType: "Inequality",
    canonicalValue: "≠",
  },
  "!=": {
    precedence: 40,
    associativity: "left",
    nodeType: "Inequality",
    canonicalValue: "≠",
  },
  "≤": {
    precedence: 40,
    associativity: "left",
    nodeType: "Inequality",
    canonicalValue: "≤",
  },
  "<=": {
    precedence: 40,
    associativity: "left",
    nodeType: "Inequality",
    canonicalValue: "≤",
  },
  "≥": {
    precedence: 40,
    associativity: "left",
    nodeType: "Inequality",
    canonicalValue: "≥",
  },
  ">=": {
    precedence: 40,
    associativity: "left",
    nodeType: "Inequality",
    canonicalValue: "≥",
  },
  "<": {
    precedence: 40,
    associativity: "left",
    nodeType: "Inequality",
    canonicalValue: "<",
  },
  ">": {
    precedence: 40,
    associativity: "left",
    nodeType: "Inequality",
    canonicalValue: ">",
  },
  "+": {
    precedence: 50,
    associativity: "left",
    nodeType: "Operator",
    canonicalValue: "+",
  },
  "-": {
    precedence: 50,
    associativity: "left",
    nodeType: "Operator",
    canonicalValue: "-",
  },
  "*": {
    precedence: 60,
    associativity: "left",
    nodeType: "Operator",
    canonicalValue: "*",
  },
  "/": {
    precedence: 60,
    associativity: "left",
    nodeType: "Operator",
    canonicalValue: "/",
  },
  "×": {
    precedence: 60,
    associativity: "left",
    nodeType: "Operator",
    canonicalValue: "*",
  },
  "^": {
    precedence: 70,
    associativity: "right",
    nodeType: "Operator",
    canonicalValue: "^",
  },
};

const UNARY_PREFIX_PRECEDENCE = 80;

export function parseFormula(input: string, idPrefix = "node"): ASTNode {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ParseError("Formula expression cannot be empty", 1, 1, input);
  }

  const tokens = tokenizeFormula(input);
  let pos = 0;

  function peek(): Token {
    return tokens[pos];
  }

  function consume(): Token {
    const tok = tokens[pos];
    pos++;
    return tok;
  }

  function parseExpression(minPrecedence: number): ASTNode {
    const token = peek();

    let left: ASTNode;

    // Quantifiers (#2091): ∀ n, body and ∃ x y, body. The body runs as far
    // right as it can, and several names nest one binder per name.
    if (
      token.type === "OPERATOR" &&
      (token.value === "∀" || token.value === "∃")
    ) {
      const quantifier = consume();
      const names: string[] = [];
      while (peek().type === "IDENTIFIER") names.push(consume().value);
      if (names.length === 0) {
        const next = peek();
        throw new ParseError(
          `Expected a variable name after '${quantifier.value}'`,
          next.column,
          1,
          input
        );
      }
      const comma = peek();
      if (comma.type !== "COMMA") {
        throw new ParseError(
          `Expected ',' after the bound variable${names.length > 1 ? "s" : ""}`,
          comma.column,
          1,
          input
        );
      }
      consume();
      let body = parseExpression(0);
      for (const name of [...names].reverse()) {
        body = {
          id: generateId(idPrefix),
          type: quantifier.value === "∀" ? "Forall" : "Exists",
          value: name,
          children: [body],
        };
      }
      return body;
    }

    // Handle Unary Prefix Operators: ~, ¬, !, -, +
    if (
      token.type === "OPERATOR" &&
      ["~", "¬", "!", "-", "+"].includes(token.value)
    ) {
      const opToken = consume();
      const operand = parseExpression(UNARY_PREFIX_PRECEDENCE);
      if (["~", "¬", "!"].includes(opToken.value)) {
        left = {
          id: generateId(idPrefix),
          type: "Negation",
          value: "¬",
          children: [operand],
        };
      } else {
        left = {
          id: generateId(idPrefix),
          type: "Operator",
          value: opToken.value,
          children: [operand],
        };
      }
    } else if (token.type === "LPAREN") {
      consume(); // '('
      left = parseExpression(0);
      const next = peek();
      if (next.type !== "RPAREN") {
        throw new ParseError(
          `Expected closing ')' but found ${next.type === "EOF" ? "end of expression" : `'${next.value}'`}`,
          next.column,
          1,
          input
        );
      }
      consume(); // ')'
    } else if (token.type === "NUMBER") {
      const tok = consume();
      const numVal = Number(tok.value);
      left = {
        id: generateId(idPrefix),
        type: "Constant",
        value: isNaN(numVal) ? tok.value : numVal,
      };
    } else if (token.type === "BOOLEAN") {
      const tok = consume();
      left = {
        id: generateId(idPrefix),
        type: "Boolean",
        value: tok.value === "true",
      };
    } else if (token.type === "IDENTIFIER") {
      const tok = consume();
      if (peek().type === "LPAREN") {
        // Function application such as σ(n) or S(k + 1).
        consume();
        const args: ASTNode[] = [parseExpression(0)];
        while (peek().type === "COMMA") {
          consume();
          args.push(parseExpression(0));
        }
        const close = peek();
        if (close.type !== "RPAREN") {
          throw new ParseError(
            `Expected closing ')' but found ${close.type === "EOF" ? "end of expression" : `'${close.value}'`}`,
            close.column,
            1,
            input
          );
        }
        consume();
        left = {
          id: generateId(idPrefix),
          type: "Function",
          value: tok.value,
          children: args,
        };
      } else {
        left = {
          id: generateId(idPrefix),
          type: "Variable",
          value: tok.value,
        };
      }
    } else {
      throw new ParseError(
        `Unexpected token '${token.value || token.type}'`,
        token.column,
        1,
        input
      );
    }

    // Pratt loop for infix binary operators
    while (pos < tokens.length) {
      const nextToken = peek();
      if (nextToken.type !== "OPERATOR") {
        break;
      }

      const opDef = BINARY_OPERATORS[nextToken.value];
      if (!opDef) {
        break;
      }

      if (opDef.precedence < minPrecedence) {
        break;
      }

      consume();
      const nextMinPrecedence =
        opDef.associativity === "right"
          ? opDef.precedence
          : opDef.precedence + 1;

      const right = parseExpression(nextMinPrecedence);

      left = {
        id: generateId(idPrefix),
        type: opDef.nodeType,
        value: opDef.canonicalValue,
        children: [left, right],
      };
    }

    return left;
  }

  const ast = parseExpression(0);
  const trailing = peek();
  if (trailing.type !== "EOF") {
    throw new ParseError(
      `Unexpected token '${trailing.value}' after complete expression`,
      trailing.column,
      1,
      input
    );
  }

  return ast;
}

export function parseFormulaWithError(
  input: string,
  idPrefix = "node"
): { ast: ASTNode | null; error: string | null; column?: number } {
  try {
    const ast = parseFormula(input, idPrefix);
    return { ast, error: null };
  } catch (err) {
    if (err instanceof ParseError) {
      return {
        ast: null,
        error: err.formattedMessage,
        column: err.column,
      };
    }
    return {
      ast: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function parseHypotheses(input: string, idPrefix = "hyp"): ASTNode[] {
  if (!input || !input.trim()) return [];

  // Split by newline or semicolon, or comma outside parens
  const items: string[] = [];
  let current = "";
  let parenDepth = 0;
  // A comma that ends a quantifier's binder list (∀ n, ...) is part of the
  // hypothesis, not a separator between two.
  let openBinders = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;
    else if (char === "∀" || char === "∃") openBinders++;
    else if (
      /^(forall|exists)\b/.test(input.slice(i)) &&
      !/\w/.test(input[i - 1] ?? "")
    ) {
      openBinders++;
    }

    if (char === "," && parenDepth === 0 && openBinders > 0) {
      openBinders--;
      current += char;
      continue;
    }
    if (char === "\n" || char === ";") openBinders = 0;

    if ((char === "," || char === ";" || char === "\n") && parenDepth === 0) {
      if (current.trim()) items.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    items.push(current.trim());
  }

  return items.map((item, idx) => {
    let name = `h${idx + 1}`;
    let formulaStr = item;

    // Check for "name: formula" format e.g. "h1: a = b"
    const colonIdx = item.indexOf(":");
    if (colonIdx > 0 && colonIdx < item.length - 1) {
      const candidateName = item.slice(0, colonIdx).trim();
      if (/^[a-zA-Z0-9_]+$/.test(candidateName)) {
        name = candidateName;
        formulaStr = item.slice(colonIdx + 1).trim();
      }
    }

    const ast = parseFormula(formulaStr, `${idPrefix}-${idx + 1}`);
    ast.metadata = { ...(ast.metadata || {}), name };
    return ast;
  });
}
