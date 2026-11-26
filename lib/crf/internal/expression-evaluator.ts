import {
  AstCondition,
  AstOperator,
  ClinicalDataType,
  ConditionGroup,
  ConditionResult,
  EditCheckRule,
  CRFField,
} from "../types";
import { isCdiscNullFlavor } from "./precision-date";
import { clamp } from "../../game-utils";

/**
 * Unified Missing Value & CDISC Null Flavor Guard
 * Returns true if a value is null, undefined, empty string, or a valid CDISC null flavor code (e.g. ND, NA, UNK, ASKU, NASK, MSK).
 */
export function isMissingOrNullFlavor(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "") return true;
    if (isCdiscNullFlavor(trimmed)) return true;
  }
  return false;
}

/**
 * Tokenizer & Safe Recursive Descent Parser for Clinical Expressions
 * Avoids any use of `eval()` or `Function()` constructor.
 */
export type TokenType =
  "NUMBER" | "IDENTIFIER" | "OP" | "LPAREN" | "RPAREN" | "COMMA";

export interface Token {
  type: TokenType;
  value: string;
  start?: number;
  end?: number;
}

export type FormulaEvaluationErrorCode =
  | "SYNTAX_ERROR"
  | "UNKNOWN_FUNCTION"
  | "UNRESOLVED_VARIABLE"
  | "DIVISION_BY_ZERO"
  | "EVALUATION_ERROR";

export interface FormulaEvaluationError {
  code: FormulaEvaluationErrorCode;
  message: string;
}

export type FormulaEvaluationResult =
  | { success: true; value: number | null }
  | { success: false; error: FormulaEvaluationError };

class FormulaParseError extends Error {
  readonly code: FormulaEvaluationErrorCode;

  constructor(code: FormulaEvaluationErrorCode, message: string) {
    super(message);
    this.name = "FormulaParseError";
    this.code = code;
  }
}

const SUPPORTED_MATH_FUNCTIONS = new Set([
  "round",
  "sqrt",
  "cbrt",
  "clamp",
  "abs",
  "max",
  "min",
  "floor",
  "ceil",
  "exp",
  "log",
]);

const NUMBER_LITERAL = String.raw`(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
const NUMBER_LITERAL_RE = new RegExp(`^${NUMBER_LITERAL}`);
const NUMERIC_INPUT_RE = new RegExp(`^[+-]?${NUMBER_LITERAL}$`);

function readFormulaInput(rawValue: unknown): number | null {
  if (isMissingOrNullFlavor(rawValue)) return null;
  if (typeof rawValue === "number") return rawValue;
  if (typeof rawValue === "string" && NUMERIC_INPUT_RE.test(rawValue.trim())) {
    return Number(rawValue);
  }
  return NaN;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
      continue;
    }

    if (ch === ",") {
      tokens.push({ type: "COMMA", value: "," });
      i++;
      continue;
    }

    if (
      ch === "+" ||
      ch === "-" ||
      ch === "*" ||
      ch === "/" ||
      ch === "%" ||
      ch === "^"
    ) {
      tokens.push({ type: "OP", value: ch });
      i++;
      continue;
    }

    // Numbers (integers, decimals, or scientific notation)
    const numMatch = NUMBER_LITERAL_RE.exec(input.slice(i));
    if (numMatch) {
      tokens.push({ type: "NUMBER", value: numMatch[0] });
      i += numMatch[0].length;
      continue;
    }

    // Identifiers or function names (e.g. weight, height, round, sqrt, max, min)
    if (/[a-zA-Z_]/.test(ch)) {
      let idStr = "";
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        idStr += input[i];
        i++;
      }
      tokens.push({ type: "IDENTIFIER", value: idStr });
      continue;
    }

    throw new FormulaParseError(
      "SYNTAX_ERROR",
      `Unexpected character "${ch}" at position ${i}`
    );
  }

  return tokens;
}

export class ExpressionEvaluator {
  private tokens: Token[];
  private pos: number;
  private context: Record<string, number | null>;
  private allowUnknownVarsDepth: number;

  constructor(tokens: Token[], context: Record<string, number | null>) {
    this.tokens = tokens;
    this.pos = 0;
    this.context = context;
    this.allowUnknownVarsDepth = 0;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(expectedType?: TokenType): Token {
    const token = this.tokens[this.pos++];
    if (!token) {
      throw new FormulaParseError(
        "SYNTAX_ERROR",
        "Unexpected end of expression"
      );
    }
    if (expectedType && token.type !== expectedType) {
      throw new FormulaParseError(
        "SYNTAX_ERROR",
        `Expected token ${expectedType} but got ${token.type} (${token.value})`
      );
    }
    return token;
  }

  // Grammar:
  // Expr   ::= AddExpr
  // AddExpr::= MulExpr (('+' | '-') MulExpr)*
  // MulExpr::= PowExpr (('*' | '/' | '%') PowExpr)*
  // PowExpr::= Primary ('^' PowExpr)?
  // Primary::= NUMBER | IDENTIFIER | FunctionCall | '(' Expr ')' | '-' Primary

  public parseResult(): FormulaEvaluationResult {
    this.pos = 0;
    if (this.tokens.length === 0) {
      return {
        success: false,
        error: {
          code: "SYNTAX_ERROR",
          message: "Formula expression cannot be empty",
        },
      };
    }
    try {
      const res = this.parseAdd();
      if (this.pos < this.tokens.length) {
        const trailing = this.tokens[this.pos];
        throw new FormulaParseError(
          "SYNTAX_ERROR",
          `Unexpected trailing token "${trailing.value}" (${trailing.type})`
        );
      }
      if (res !== null && !Number.isFinite(res)) {
        return {
          success: false,
          error: {
            code: "EVALUATION_ERROR",
            message: "Expression evaluated to a non-finite number",
          },
        };
      }
      return { success: true, value: res };
    } catch (err) {
      if (err instanceof FormulaParseError) {
        return {
          success: false,
          error: { code: err.code, message: err.message },
        };
      }
      return {
        success: false,
        error: {
          code: "SYNTAX_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  public parse(): number | null {
    const result = this.parseResult();
    return result.success ? result.value : null;
  }

  private parseAdd(): number | null {
    let left = this.parseMul();

    while (this.pos < this.tokens.length) {
      const next = this.peek();
      if (
        next &&
        next.type === "OP" &&
        (next.value === "+" || next.value === "-")
      ) {
        const op = this.consume().value;
        const right = this.parseMul();
        if (left === null || right === null) {
          left = null;
        } else if (op === "+") {
          left = left + right;
        } else {
          left = left - right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  private parseMul(): number | null {
    let left = this.parsePow();

    while (this.pos < this.tokens.length) {
      const next = this.peek();
      if (
        next &&
        next.type === "OP" &&
        (next.value === "*" || next.value === "/" || next.value === "%")
      ) {
        const op = this.consume().value;
        const right = this.parsePow();
        if (op === "/" && right === 0) {
          throw new FormulaParseError("DIVISION_BY_ZERO", "Division by zero");
        }
        if (op === "%" && right === 0) {
          throw new FormulaParseError("DIVISION_BY_ZERO", "Modulo by zero");
        }
        if (left === null || right === null) {
          left = null;
        } else if (op === "*") {
          left = left * right;
        } else if (op === "/") {
          left = left / right;
        } else if (op === "%") {
          left = left % right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  private parsePow(): number | null {
    const base = this.parsePrimary();

    const next = this.peek();
    if (next && next.type === "OP" && next.value === "^") {
      this.consume();
      const exponent = this.parsePow();
      if (base === 0 && exponent !== null && exponent < 0) {
        throw new FormulaParseError(
          "DIVISION_BY_ZERO",
          "Division by zero in negative exponentiation"
        );
      }
      if (base === null || exponent === null) return null;
      return Math.pow(base, exponent);
    }
    return base;
  }

  private parsePrimary(): number | null {
    const token = this.peek();
    if (!token) {
      throw new FormulaParseError(
        "SYNTAX_ERROR",
        "Unexpected end of expression in primary"
      );
    }

    // Unary minus
    if (token.type === "OP" && token.value === "-") {
      this.consume();
      const val = this.parsePrimary();
      return val === null ? null : -val;
    }

    if (token.type === "NUMBER") {
      this.consume();
      const val = parseFloat(token.value);
      if (!Number.isFinite(val)) {
        throw new FormulaParseError(
          "SYNTAX_ERROR",
          `Invalid numeric literal "${token.value}"`
        );
      }
      return val;
    }

    if (token.type === "LPAREN") {
      this.consume("LPAREN");
      if (this.peek()?.type === "RPAREN") {
        throw new FormulaParseError(
          "SYNTAX_ERROR",
          "Empty parentheses '()' are not permitted"
        );
      }
      const result = this.parseAdd();
      this.consume("RPAREN");
      return result;
    }

    if (token.type === "IDENTIFIER") {
      const idToken = this.consume("IDENTIFIER");
      const next = this.peek();

      // Function Call (e.g. round(x, 1), sqrt(x), abs(x), max(a,b), min(a,b))
      if (next && next.type === "LPAREN") {
        const fnName = idToken.value.toLowerCase();
        const isKnownFn = SUPPORTED_MATH_FUNCTIONS.has(fnName);

        this.consume("LPAREN");
        const args: (number | null)[] = [];
        if (!isKnownFn) {
          this.allowUnknownVarsDepth++;
        }
        try {
          if (this.peek()?.type !== "RPAREN") {
            args.push(this.parseAdd());
            while (this.peek()?.type === "COMMA") {
              this.consume("COMMA");
              args.push(this.parseAdd());
            }
          }
        } finally {
          if (!isKnownFn) {
            this.allowUnknownVarsDepth--;
          }
        }
        this.consume("RPAREN");

        if (!isKnownFn) {
          throw new FormulaParseError(
            "UNKNOWN_FUNCTION",
            `Unknown mathematical function "${idToken.value}"`
          );
        }

        if (fnName === "round" && (args.length < 1 || args.length > 2)) {
          throw new FormulaParseError(
            "SYNTAX_ERROR",
            `Function "round" expects 1 or 2 arguments, received ${args.length}`
          );
        }
        if (fnName === "clamp" && args.length !== 3) {
          throw new FormulaParseError(
            "SYNTAX_ERROR",
            `Function "clamp" expects 3 arguments, received ${args.length}`
          );
        }
        if ((fnName === "max" || fnName === "min") && args.length < 1) {
          throw new FormulaParseError(
            "SYNTAX_ERROR",
            `Function "${fnName}" expects at least 1 argument`
          );
        }
        if (
          (fnName === "sqrt" ||
            fnName === "cbrt" ||
            fnName === "abs" ||
            fnName === "floor" ||
            fnName === "ceil" ||
            fnName === "exp" ||
            fnName === "log") &&
          args.length !== 1
        ) {
          throw new FormulaParseError(
            "SYNTAX_ERROR",
            `Function "${fnName}" expects 1 argument, received ${args.length}`
          );
        }

        if (args.some((a) => a === null)) {
          return null;
        }
        const numArgs = args as number[];

        switch (fnName) {
          case "round":
            if (numArgs.length >= 2) {
              const factor = Math.pow(10, numArgs[1]);
              return Math.round(numArgs[0] * factor) / factor;
            }
            return Math.round(numArgs[0]);
          case "sqrt":
            if (numArgs[0] < 0) {
              throw new FormulaParseError(
                "EVALUATION_ERROR",
                "Square root of negative number is undefined"
              );
            }
            return Math.sqrt(numArgs[0]);
          case "cbrt":
            return Math.cbrt(numArgs[0]);
          case "clamp":
            // Formula semantics: NaN propagates, and inverted bounds
            // resolve to the upper argument (clamp(x, 10, 0) === 0).
            if (Number.isNaN(numArgs[0])) return NaN;
            return clamp(
              numArgs[0],
              Math.min(numArgs[1], numArgs[2]),
              numArgs[2]
            );
          case "abs":
            return Math.abs(numArgs[0]);
          case "max":
            return Math.max(...numArgs);
          case "min":
            return Math.min(...numArgs);
          case "floor":
            return Math.floor(numArgs[0]);
          case "ceil":
            return Math.ceil(numArgs[0]);
          case "exp":
            return Math.exp(numArgs[0]);
          case "log":
            if (numArgs[0] <= 0) {
              throw new FormulaParseError(
                "EVALUATION_ERROR",
                "Logarithm of non-positive number is undefined"
              );
            }
            return Math.log(numArgs[0]);
          default:
            throw new FormulaParseError(
              "UNKNOWN_FUNCTION",
              `Unknown mathematical function "${idToken.value}"`
            );
        }
      }

      // Variable reference lookup
      const varKey = idToken.value.toLowerCase();
      if (Object.hasOwn(this.context, varKey)) {
        const value = this.context[varKey];
        if (value !== null && !Number.isFinite(value)) {
          throw new FormulaParseError(
            "EVALUATION_ERROR",
            `Variable "${idToken.value}" must have a finite numeric value`
          );
        }
        return value;
      }
      if (this.allowUnknownVarsDepth > 0) {
        return null;
      }
      throw new FormulaParseError(
        "UNRESOLVED_VARIABLE",
        `Unresolved variable "${idToken.value}"`
      );
    }

    throw new FormulaParseError(
      "SYNTAX_ERROR",
      `Unexpected token ${token.type} (${token.value})`
    );
  }
}

/**
 * Parses and evaluates a clinical formula, distinguishing missing clinical values
 * from syntax, unknown-function, unresolved-variable, and division-by-zero errors.
 *
 * @param formula - Arithmetic string expression
 * @param fieldValues - Map of variable names and field IDs to values
 * @param fieldsList - Array of form fields for identifier resolution
 * @returns Discriminated union result with evaluated number, null for missing clinical data, or typed failure
 */
export function parseAndEvaluateFormula(
  formula: string,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  fieldsList: CRFField[]
): FormulaEvaluationResult {
  if (!formula || typeof formula !== "string" || !formula.trim()) {
    return {
      success: false,
      error: {
        code: "SYNTAX_ERROR",
        message: "Formula expression cannot be empty",
      },
    };
  }

  // Build lookup mapping lowercase variable names and field IDs to numeric values or null
  const context: Record<string, number | null> = Object.create(null);
  const lowerFieldValues = new Map<string, unknown>();

  Object.entries(fieldValues || {}).forEach(([k, rawVal]) => {
    const lowerKey = k.toLowerCase();
    lowerFieldValues.set(lowerKey, rawVal);
    context[lowerKey] = readFormulaInput(rawVal);
  });

  (fieldsList || []).forEach((f) => {
    const idKey = f.id.toLowerCase();
    const varKey = f.variableName.toLowerCase();
    const rawVal =
      fieldValues?.[f.id] ??
      lowerFieldValues.get(idKey) ??
      fieldValues?.[f.variableName] ??
      lowerFieldValues.get(varKey) ??
      f.nullFlavorValue;

    const value = readFormulaInput(rawVal);
    if (value !== null) {
      context[idKey] = value;
      context[varKey] = value;
    } else {
      context[idKey] ??= null;
      context[varKey] ??= null;
    }
  });

  try {
    const tokens = tokenize(formula);
    const evaluator = new ExpressionEvaluator(tokens, context);
    return evaluator.parseResult();
  } catch (err) {
    if (err instanceof FormulaParseError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    return {
      success: false,
      error: {
        code: "SYNTAX_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Safely evaluates a math formula with dynamic field variables
 *
 * @param formula - Arithmetic string expression
 * @param fieldValues - Map of variable names and field IDs to values
 * @param fieldsList - Array of form fields for identifier resolution
 * @returns Evaluated numeric result or null when uncalculated / zero denominator / invalid syntax
 */
export function evaluateFormula(
  formula: string,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  fieldsList: CRFField[]
): number | null {
  const result = parseAndEvaluateFormula(formula, fieldValues, fieldsList);
  return result.success ? result.value : null;
}

/**
 * Calculates Body Mass Index (BMI) in kg/m^2.
 */
export function calculateBMI(
  weightKg: number,
  heightCm: number
): number | null {
  if (heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/**
 * Calculates Mosteller Body Surface Area (BSA) in m^2.
 */
export function calculateMostellerBSA(
  heightCm: number,
  weightKg: number
): number | null {
  if (heightCm <= 0 || weightKg < 0) return null;
  return Math.round(Math.sqrt((heightCm * weightKg) / 3600) * 100) / 100;
}

/**
 * Calculates DuBois & DuBois Body Surface Area (BSA) in m^2.
 */
export function calculateDuboisBSA(
  heightCm: number,
  weightKg: number
): number | null {
  if (heightCm <= 0 || weightKg < 0) return null;
  const bsa = 0.007184 * Math.pow(heightCm, 0.725) * Math.pow(weightKg, 0.425);
  return Math.round(bsa * 100) / 100;
}

/**
 * Calculates Cockcroft-Gault Creatinine Clearance (CrCl) in mL/min.
 */
export function calculateCockcroftGaultCrCl(
  age: number,
  weightKg: number,
  serumCrMgDl: number,
  isFemale: boolean
): number | null {
  if (serumCrMgDl <= 0) return null;
  const base = ((140 - age) * weightKg) / (72 * serumCrMgDl);
  const factor = isFemale ? 0.85 : 1.0;
  return Math.round(base * factor * 10) / 10;
}

/**
 * Calculates Bazett Corrected QT interval (QTcB) in milliseconds.
 */
export function calculateBazettQTc(qtMs: number, rrSec: number): number | null {
  if (rrSec <= 0) return null;
  return Math.round(qtMs / Math.sqrt(rrSec));
}

/**
 * Calculates Fridericia Corrected QT interval (QTcF) in milliseconds.
 */
export function calculateFridericiaQTc(
  qtMs: number,
  rrSec: number
): number | null {
  if (rrSec <= 0) return null;
  return Math.round(qtMs / Math.cbrt(rrSec));
}

/**
 * Calculates RECIST 1.1 Sum of Longest Diameters percentage change from baseline.
 */
export function calculateRecistSldChange(
  baselineSldMm: number,
  currentSldMm: number
): number | null {
  if (baselineSldMm <= 0) return null;
  const diff = currentSldMm - baselineSldMm;
  return Math.round((diff / baselineSldMm) * 1000) / 10;
}

/**
 * Resolves a field's effective value, honoring cross-visit / visit-scoped
 * lookup keys and the field's active CDISC null-flavor fallback. Shared by
 * evaluateCondition (fieldId) and evaluateConditionResult (fieldId and,
 * for field/field checks, compareFieldId), so the two never drift apart on
 * how a field's value is actually looked up.
 */
function resolveFieldValue(
  fieldId: string,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  fieldsList: CRFField[],
  visitContext?: string,
  crossVisitId?: string
): string | number | boolean | null | undefined {
  const targetField = fieldsList.find(
    (f) => f.id === fieldId || f.variableName === fieldId
  );

  let actualVal: string | number | boolean | null | undefined;
  if (crossVisitId) {
    const crossKey = `${crossVisitId}_${fieldId}`;
    const crossVarKey = targetField
      ? `${crossVisitId}_${targetField.id}`
      : crossKey;
    const crossNameKey = targetField
      ? `${crossVisitId}_${targetField.variableName}`
      : crossKey;
    actualVal =
      fieldValues[crossKey] ??
      fieldValues[crossVarKey] ??
      fieldValues[crossNameKey] ??
      fieldValues[fieldId] ??
      (targetField
        ? (fieldValues[targetField.id] ?? fieldValues[targetField.variableName])
        : undefined);
  } else if (visitContext) {
    const scopedKey = `${visitContext}_${fieldId}`;
    const scopedVarKey = targetField
      ? `${visitContext}_${targetField.id}`
      : scopedKey;
    const scopedNameKey = targetField
      ? `${visitContext}_${targetField.variableName}`
      : scopedKey;
    actualVal =
      fieldValues[scopedKey] ??
      fieldValues[scopedVarKey] ??
      fieldValues[scopedNameKey] ??
      fieldValues[fieldId] ??
      (targetField
        ? (fieldValues[targetField.id] ?? fieldValues[targetField.variableName])
        : undefined);
  } else {
    actualVal =
      fieldValues[fieldId] ??
      (targetField
        ? (fieldValues[targetField.id] ?? fieldValues[targetField.variableName])
        : undefined);
  }

  if (
    (actualVal === undefined || actualVal === null || actualVal === "") &&
    targetField?.nullFlavorValue
  ) {
    actualVal = targetField.nullFlavorValue;
  }

  return actualVal;
}

/**
 * Evaluate single AST condition
 */
export function evaluateCondition(
  condition: AstCondition,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  fieldsList: CRFField[],
  visitContext?: string
): boolean {
  const actualVal = resolveFieldValue(
    condition.fieldId,
    fieldValues,
    fieldsList,
    visitContext,
    condition.crossVisitId
  );

  const actMissing = isMissingOrNullFlavor(actualVal);

  switch (condition.operator) {
    case "is_empty":
      return actMissing;
    case "is_not_empty":
      return !actMissing;
    case "eq": {
      const condMissing = isMissingOrNullFlavor(condition.value);
      if (actMissing && condMissing) return true;
      if (actMissing || condMissing) return false;
      return (
        String(actualVal).toLowerCase() ===
        String(condition.value).toLowerCase()
      );
    }
    case "neq": {
      const condMissing = isMissingOrNullFlavor(condition.value);
      if (actMissing && condMissing) return false;
      if (actMissing || condMissing) return true;
      return (
        String(actualVal).toLowerCase() !==
        String(condition.value).toLowerCase()
      );
    }
    case "gt": {
      if (actMissing || isMissingOrNullFlavor(condition.value)) return false;
      const numAct =
        typeof actualVal === "number"
          ? actualVal
          : parseFloat(String(actualVal));
      const numCond =
        typeof condition.value === "number"
          ? condition.value
          : parseFloat(String(condition.value));
      return (
        Number.isFinite(numAct) && Number.isFinite(numCond) && numAct > numCond
      );
    }
    case "gte": {
      if (actMissing || isMissingOrNullFlavor(condition.value)) return false;
      const numAct =
        typeof actualVal === "number"
          ? actualVal
          : parseFloat(String(actualVal));
      const numCond =
        typeof condition.value === "number"
          ? condition.value
          : parseFloat(String(condition.value));
      return (
        Number.isFinite(numAct) && Number.isFinite(numCond) && numAct >= numCond
      );
    }
    case "lt": {
      if (actMissing || isMissingOrNullFlavor(condition.value)) return false;
      const numAct =
        typeof actualVal === "number"
          ? actualVal
          : parseFloat(String(actualVal));
      const numCond =
        typeof condition.value === "number"
          ? condition.value
          : parseFloat(String(condition.value));
      return (
        Number.isFinite(numAct) && Number.isFinite(numCond) && numAct < numCond
      );
    }
    case "lte": {
      if (actMissing || isMissingOrNullFlavor(condition.value)) return false;
      const numAct =
        typeof actualVal === "number"
          ? actualVal
          : parseFloat(String(actualVal));
      const numCond =
        typeof condition.value === "number"
          ? condition.value
          : parseFloat(String(condition.value));
      return (
        Number.isFinite(numAct) && Number.isFinite(numCond) && numAct <= numCond
      );
    }
    case "contains": {
      if (actMissing || isMissingOrNullFlavor(condition.value)) return false;
      return String(actualVal)
        .toLowerCase()
        .includes(String(condition.value).toLowerCase());
    }
    case "in": {
      if (actMissing) return false;
      if (Array.isArray(condition.value)) {
        return condition.value.some(
          (v) =>
            !isMissingOrNullFlavor(v) &&
            String(v).toLowerCase() === String(actualVal).toLowerCase()
        );
      }
      return false;
    }
    default:
      return false;
  }
}

/**
 * Evaluate full edit check rule conditions
 */
export function evaluateRule(
  rule: EditCheckRule,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  fieldsList: CRFField[],
  visitContext?: string
): boolean {
  if (!rule.conditions || rule.conditions.length === 0) return true;

  if (rule.logicalOperator === "OR") {
    return rule.conditions.some((cond) =>
      evaluateCondition(cond, fieldValues, fieldsList, visitContext)
    );
  } else {
    return rule.conditions.every((cond) =>
      evaluateCondition(cond, fieldValues, fieldsList, visitContext)
    );
  }
}

// --- Grouped, field/field-aware, four-valued discrepancy checks (#540) ---
//
// evaluateCondition/evaluateRule above stay exactly as they were: they
// return a plain boolean, treat any indeterminate case as false, and only
// ever compare a field against a literal. They remain the API for every
// existing caller.
//
// The functions below add what #540 asks for on top, without changing
// that existing behavior: field/field operands (`compareFieldId`),
// explicit two-level AND/OR grouping (`conditionGroups`), and a fourth
// "incompatible" result distinct from "missing" - a genuine type mismatch
// or an operator this evaluator doesn't recognize (as can arrive via
// import) is never silently reported as a confident false.

const ORDERING_OPERATORS = new Set<AstOperator>(["gt", "gte", "lt", "lte"]);
const KNOWN_OPERATORS = new Set<AstOperator>([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "contains",
  "is_empty",
  "is_not_empty",
]);

type DataTypeFamily = "numeric" | "date" | "time" | "text" | "unknown";

function getDataTypeFamily(
  dataType: ClinicalDataType | undefined
): DataTypeFamily {
  switch (dataType) {
    case "number":
    case "integer":
    case "vas_scale":
    case "nrs_scale":
    case "calculated":
      return "numeric";
    case "date":
    case "partial_date":
    case "precision_date":
    case "datetime":
      return "date";
    case "time":
      return "time";
    case "text":
    case "textarea":
    case "single_select":
    case "multi_select":
    case "radio":
    case "checkbox":
    case "repeating_table":
    case "signature":
      return "text";
    default:
      return "unknown";
  }
}

function describeField(fieldId: string, fieldsList: CRFField[]): string {
  const field = fieldsList.find(
    (f) => f.id === fieldId || f.variableName === fieldId
  );
  return field ? field.variableName : fieldId;
}

/**
 * Evaluate a single AST condition to a four-valued result: "true", "false",
 * "missing" (an operand has no value), or "incompatible" (a type mismatch,
 * or an operator this evaluator doesn't recognize - defensive against an
 * imported expression using a shape this app never authors itself).
 */
export function evaluateConditionResult(
  condition: AstCondition,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  fieldsList: CRFField[],
  visitContext?: string
): ConditionResult {
  if (!KNOWN_OPERATORS.has(condition.operator)) {
    return "incompatible";
  }

  const targetField = fieldsList.find(
    (f) => f.id === condition.fieldId || f.variableName === condition.fieldId
  );
  const actualVal = resolveFieldValue(
    condition.fieldId,
    fieldValues,
    fieldsList,
    visitContext,
    condition.crossVisitId
  );
  const actMissing = isMissingOrNullFlavor(actualVal);

  let comparedField: CRFField | undefined;
  let comparedVal: string | number | boolean | string[] | null | undefined;
  if (condition.compareFieldId) {
    comparedField = fieldsList.find(
      (f) =>
        f.id === condition.compareFieldId ||
        f.variableName === condition.compareFieldId
    );
    comparedVal = resolveFieldValue(
      condition.compareFieldId,
      fieldValues,
      fieldsList,
      visitContext
    );
  } else {
    comparedVal = condition.value;
  }
  const condMissing = isMissingOrNullFlavor(comparedVal);

  // Type compatibility (#540): a field/field check compares two real
  // types directly; a field/literal ordering comparison only makes sense
  // against a numeric, date, or time field.
  if (condition.compareFieldId && comparedField) {
    const familyA = getDataTypeFamily(targetField?.dataType);
    const familyB = getDataTypeFamily(comparedField.dataType);
    if (familyA !== "unknown" && familyB !== "unknown" && familyA !== familyB) {
      return "incompatible";
    }
  } else if (ORDERING_OPERATORS.has(condition.operator)) {
    const family = getDataTypeFamily(targetField?.dataType);
    if (
      family !== "unknown" &&
      family !== "numeric" &&
      family !== "date" &&
      family !== "time"
    ) {
      return "incompatible";
    }
  }

  switch (condition.operator) {
    case "is_empty":
      return actMissing ? "true" : "false";
    case "is_not_empty":
      return actMissing ? "false" : "true";
    case "eq": {
      if (actMissing && condMissing) return "true";
      if (actMissing || condMissing) return "missing";
      return String(actualVal).toLowerCase() ===
        String(comparedVal).toLowerCase()
        ? "true"
        : "false";
    }
    case "neq": {
      if (actMissing && condMissing) return "false";
      if (actMissing || condMissing) return "missing";
      return String(actualVal).toLowerCase() !==
        String(comparedVal).toLowerCase()
        ? "true"
        : "false";
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (actMissing || condMissing) return "missing";
      const numAct =
        typeof actualVal === "number"
          ? actualVal
          : parseFloat(String(actualVal));
      const numCmp =
        typeof comparedVal === "number"
          ? comparedVal
          : parseFloat(String(comparedVal));
      if (!Number.isFinite(numAct) || !Number.isFinite(numCmp))
        return "incompatible";
      if (condition.operator === "gt")
        return numAct > numCmp ? "true" : "false";
      if (condition.operator === "gte")
        return numAct >= numCmp ? "true" : "false";
      if (condition.operator === "lt")
        return numAct < numCmp ? "true" : "false";
      return numAct <= numCmp ? "true" : "false";
    }
    case "contains": {
      if (actMissing || condMissing) return "missing";
      return String(actualVal)
        .toLowerCase()
        .includes(String(comparedVal).toLowerCase())
        ? "true"
        : "false";
    }
    case "in": {
      if (actMissing) return "missing";
      if (!Array.isArray(comparedVal)) return "incompatible";
      return comparedVal.some(
        (v) =>
          !isMissingOrNullFlavor(v) &&
          String(v).toLowerCase() === String(actualVal).toLowerCase()
      )
        ? "true"
        : "false";
    }
    default:
      return "incompatible";
  }
}

/**
 * Combines four-valued results under AND/OR. Definite answers (true for
 * OR, false for AND) short-circuit first, exactly as two-valued logic
 * would. When neither operand is decisive, "incompatible" is reported
 * ahead of "missing": a type mismatch or unrecognized operator is a
 * defect to fix, which is a more actionable diagnostic than "no value
 * entered yet" when both are present in the same group.
 */
export function combineConditionResults(
  operator: "AND" | "OR",
  results: ConditionResult[]
): ConditionResult {
  if (results.length === 0) return "true";

  if (operator === "AND") {
    if (results.includes("false")) return "false";
    if (results.includes("incompatible")) return "incompatible";
    if (results.includes("missing")) return "missing";
    return "true";
  }

  if (results.includes("true")) return "true";
  if (results.includes("incompatible")) return "incompatible";
  if (results.includes("missing")) return "missing";
  return "false";
}

/**
 * Normalizes a rule's conditions into explicit groups: `conditionGroups`
 * when present (#540), otherwise the legacy flat `conditions`/
 * `logicalOperator` wrapped as a single group, so evaluation and
 * explanation only ever need to handle one shape.
 */
export function getRuleGroups(rule: EditCheckRule): {
  groups: ConditionGroup[];
  groupLogicalOperator: "AND" | "OR";
} {
  if (rule.conditionGroups && rule.conditionGroups.length > 0) {
    return {
      groups: rule.conditionGroups,
      groupLogicalOperator: rule.groupLogicalOperator ?? "AND",
    };
  }
  return {
    groups: [
      {
        id: `${rule.id}_legacy_group`,
        logicalOperator: rule.logicalOperator,
        conditions: rule.conditions || [],
      },
    ],
    groupLogicalOperator: "AND",
  };
}

/**
 * Four-valued equivalent of evaluateRule: supports conditionGroups,
 * field/field operands, and reports a preserved unsupportedExpression (an
 * imported shape this evaluator couldn't map at all) as incompatible
 * rather than silently treating it as always-true or always-false.
 */
export function evaluateRuleResult(
  rule: EditCheckRule,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  fieldsList: CRFField[],
  visitContext?: string
): ConditionResult {
  if (rule.unsupportedExpression) return "incompatible";

  const { groups, groupLogicalOperator } = getRuleGroups(rule);
  const groupResults = groups.map((group) =>
    combineConditionResults(
      group.logicalOperator,
      group.conditions.map((cond) =>
        evaluateConditionResult(cond, fieldValues, fieldsList, visitContext)
      )
    )
  );

  return combineConditionResults(groupLogicalOperator, groupResults);
}

const OPERATOR_LABELS: Partial<Record<AstOperator, string>> = {
  eq: "equals",
  neq: "does not equal",
  gt: "is greater than",
  gte: "is greater than or equal to",
  lt: "is less than",
  lte: "is less than or equal to",
  in: "is one of",
  contains: "contains",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

function formatValueForDisplay(val: unknown): string {
  if (val === undefined || val === null || val === "") return "no value";
  if (Array.isArray(val)) return `[${val.join(", ")}]`;
  return String(val);
}

function resultLabel(result: ConditionResult): string {
  switch (result) {
    case "true":
      return "TRUE";
    case "false":
      return "FALSE";
    case "missing":
      return "MISSING (no value entered)";
    case "incompatible":
      return "INCOMPATIBLE (cannot be compared)";
  }
}

/** One human-readable, truth-table-style sentence for a single leaf condition (#540). */
export function describeCondition(
  condition: AstCondition,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  fieldsList: CRFField[],
  result: ConditionResult,
  visitContext?: string
): string {
  const fieldLabel = describeField(condition.fieldId, fieldsList);
  const actualVal = resolveFieldValue(
    condition.fieldId,
    fieldValues,
    fieldsList,
    visitContext,
    condition.crossVisitId
  );
  const operatorLabel =
    OPERATOR_LABELS[condition.operator] ??
    `(unsupported operator "${condition.operator}")`;

  let base: string;
  if (
    condition.operator === "is_empty" ||
    condition.operator === "is_not_empty"
  ) {
    base = `${fieldLabel} (${formatValueForDisplay(actualVal)}) ${operatorLabel}`;
  } else {
    const comparedDescription = condition.compareFieldId
      ? describeField(condition.compareFieldId, fieldsList)
      : formatValueForDisplay(condition.value);
    base = `${fieldLabel} (${formatValueForDisplay(actualVal)}) ${operatorLabel} ${comparedDescription}`;
  }

  return `${base} → ${resultLabel(result)}`;
}

export interface ConditionExplanation {
  condition: AstCondition;
  result: ConditionResult;
  sentence: string;
}

export interface GroupExplanation {
  group: ConditionGroup;
  result: ConditionResult;
  conditionExplanations: ConditionExplanation[];
  sentence: string;
}

export interface RuleExplanation {
  result: ConditionResult;
  groupExplanations: GroupExplanation[];
  summary: string;
}

/**
 * Full truth-table-style explanation of a rule's evaluation (#540):
 * every leaf condition's own sentence and result, each group's combined
 * result, and an overall summary sentence - including the Raise Query
 * message when the rule fires and is configured to raise one.
 */
export function explainRule(
  rule: EditCheckRule,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  fieldsList: CRFField[],
  visitContext?: string
): RuleExplanation {
  if (rule.unsupportedExpression) {
    return {
      result: "incompatible",
      groupExplanations: [],
      summary: `This rule contains an imported expression this evaluator does not support (${rule.unsupportedExpression.reason}) and has been preserved without changes. It will not fire automatically until reviewed.`,
    };
  }

  const { groups, groupLogicalOperator } = getRuleGroups(rule);

  const groupExplanations: GroupExplanation[] = groups.map((group) => {
    const conditionExplanations: ConditionExplanation[] = group.conditions.map(
      (condition) => {
        const result = evaluateConditionResult(
          condition,
          fieldValues,
          fieldsList,
          visitContext
        );
        return {
          condition,
          result,
          sentence: describeCondition(
            condition,
            fieldValues,
            fieldsList,
            result,
            visitContext
          ),
        };
      }
    );
    const groupResult = combineConditionResults(
      group.logicalOperator,
      conditionExplanations.map((c) => c.result)
    );
    const joiner = group.logicalOperator === "AND" ? " AND " : " OR ";
    const sentence =
      conditionExplanations.length === 0
        ? "(no conditions - always true)"
        : `(${conditionExplanations.map((c) => c.sentence).join(joiner)})`;
    return { group, result: groupResult, conditionExplanations, sentence };
  });

  const result = combineConditionResults(
    groupLogicalOperator,
    groupExplanations.map((g) => g.result)
  );

  const groupJoiner = groupLogicalOperator === "AND" ? " AND " : " OR ";
  let summary = `${groupExplanations.map((g) => g.sentence).join(groupJoiner)} → ${resultLabel(result)}`;
  if (
    result === "true" &&
    rule.actionType === "raise_query" &&
    rule.queryMessage
  ) {
    summary += ` — Raise Query: "${rule.queryMessage}"`;
  }

  return { result, groupExplanations, summary };
}

export interface DerivationStep {
  stepNumber: number;
  description: string;
  expression: string;
  evaluatedValue?: number | string | null;
}

export interface DerivationInputDependency {
  fieldId: string;
  variableName: string;
  label: string;
  expectedUnit?: string;
  actualUnit?: string;
  value: number | string | null;
  status: "provided" | "missing" | "invalid_unit" | "invalid_value";
  message?: string;
}

export interface DerivationExplanation {
  targetFieldId?: string;
  targetVariableName?: string;
  formula: string;
  result: number | null;
  formattedResult?: string;
  status:
    | "success"
    | "missing_inputs"
    | "division_by_zero"
    | "invalid_unit"
    | "cyclic_dependency"
    | "syntax_error";
  dependencies: DerivationInputDependency[];
  steps: DerivationStep[];
  diagnostics: string[];
  summary: string;
}

/**
 * Author and explain calculated field derivations (#671):
 * Inspects formula input dependencies, validates units, detects division by zero
 * and cyclic references, and breaks down evaluation steps with clear diagnostics.
 */
export function explainCalculationDerivation(
  formula: string,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  fieldsList: CRFField[],
  targetField?: CRFField
): DerivationExplanation {
  const targetVar = targetField?.variableName || "TARGET";
  const targetId = targetField?.id || "";

  if (!formula || typeof formula !== "string" || !formula.trim()) {
    return {
      targetFieldId: targetId,
      targetVariableName: targetVar,
      formula: formula || "",
      result: null,
      status: "syntax_error",
      dependencies: [],
      steps: [],
      diagnostics: ["Formula expression is empty."],
      summary: "No calculation formula defined.",
    };
  }

  // Extract variable tokens and validate formula syntax up front
  let tokens: Token[] = [];
  try {
    tokens = tokenize(formula);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      targetFieldId: targetId,
      targetVariableName: targetVar,
      formula,
      result: null,
      status: "syntax_error",
      dependencies: [],
      steps: [],
      diagnostics: [`Syntax error while parsing formula: ${msg}`],
      summary: `Invalid formula syntax: ${msg}`,
    };
  }

  const syntaxContext: Record<string, number | null> = {};
  for (const t of tokens) {
    if (t.type === "IDENTIFIER") {
      syntaxContext[t.value.toLowerCase()] = null;
    }
  }
  const syntaxCheck = new ExpressionEvaluator(
    tokens,
    syntaxContext
  ).parseResult();
  if (
    !syntaxCheck.success &&
    (syntaxCheck.error.code === "SYNTAX_ERROR" ||
      syntaxCheck.error.code === "UNKNOWN_FUNCTION")
  ) {
    return {
      targetFieldId: targetId,
      targetVariableName: targetVar,
      formula,
      result: null,
      status: "syntax_error",
      dependencies: [],
      steps: [],
      diagnostics: [
        `Syntax error while parsing formula: ${syntaxCheck.error.message}`,
      ],
      summary: `Invalid formula syntax: ${syntaxCheck.error.message}`,
    };
  }

  // Find all variable names referenced in the formula (excluding function calls)
  const varNames = Array.from(
    new Set(
      tokens
        .filter(
          (t, idx) =>
            t.type === "IDENTIFIER" &&
            tokens[idx + 1]?.type !== "LPAREN" &&
            !SUPPORTED_MATH_FUNCTIONS.has(t.value.toLowerCase())
        )
        .map((t) => t.value)
    )
  );

  // Check for cyclic dependency: target variable or ID cannot be in formula
  const isCyclic = varNames.some(
    (v) =>
      v.toUpperCase() === targetVar.toUpperCase() ||
      (targetId && v.toLowerCase() === targetId.toLowerCase())
  );

  if (isCyclic) {
    return {
      targetFieldId: targetId,
      targetVariableName: targetVar,
      formula,
      result: null,
      status: "cyclic_dependency",
      dependencies: [],
      steps: [],
      diagnostics: [
        `Cyclic dependency detected: target field '${targetVar}' cannot reference itself in its calculation formula.`,
      ],
      summary: `Calculation failed: target '${targetVar}' references itself, creating a cyclic dependency loop.`,
    };
  }

  // Resolve dependencies
  const dependencies: DerivationInputDependency[] = [];
  const missingInputs: string[] = [];
  const invalidUnits: string[] = [];

  for (const vName of varNames) {
    const matchedField = fieldsList.find(
      (f) =>
        f.variableName.toUpperCase() === vName.toUpperCase() ||
        f.id.toLowerCase() === vName.toLowerCase()
    );

    const rawVal = matchedField
      ? (fieldValues[matchedField.id] ??
        fieldValues[matchedField.id.toLowerCase()] ??
        fieldValues[matchedField.variableName] ??
        fieldValues[matchedField.variableName.toLowerCase()] ??
        fieldValues[vName] ??
        fieldValues[vName.toLowerCase()])
      : (fieldValues[vName] ?? fieldValues[vName.toLowerCase()]);

    const fieldLabel = matchedField?.label || vName;
    const actualUnit = matchedField?.unit || undefined;

    let expectedUnit: string | undefined;
    const upper = vName.toUpperCase();
    if (upper.includes("HEIGHT") || upper === "VSORRES_HEIGHT") {
      expectedUnit = "cm";
    } else if (upper.includes("WEIGHT") || upper === "VSORRES_WEIGHT") {
      expectedUnit = "kg";
    }

    let status: DerivationInputDependency["status"] = "provided";
    let message: string | undefined;

    if (isMissingOrNullFlavor(rawVal)) {
      status = "missing";
      message = `Input value for '${vName}' is missing.`;
      missingInputs.push(vName);
    } else {
      if (!Number.isFinite(readFormulaInput(rawVal))) {
        status = "invalid_value";
        message = `Value '${rawVal}' for '${vName}' cannot be converted to a valid number.`;
        missingInputs.push(vName);
      } else if (
        expectedUnit &&
        actualUnit &&
        actualUnit.toLowerCase() !== expectedUnit.toLowerCase()
      ) {
        status = "invalid_unit";
        message = `Unit mismatch for '${vName}': expected '${expectedUnit}', got '${actualUnit}'.`;
        invalidUnits.push(`${vName} (${actualUnit} != ${expectedUnit})`);
      }
    }

    dependencies.push({
      fieldId: matchedField?.id || vName,
      variableName: matchedField?.variableName || vName,
      label: fieldLabel,
      expectedUnit,
      actualUnit,
      value: isMissingOrNullFlavor(rawVal) ? null : (rawVal as string | number),
      status,
      message,
    });
  }

  // Detect division by zero explicitly
  const steps: DerivationStep[] = [];
  const diagnostics: string[] = [];

  // Step 1: Input values
  const inputStrings = dependencies.map((d) => {
    const valStr =
      d.value !== null && d.value !== undefined ? String(d.value) : "(missing)";
    const unitStr = d.actualUnit ? ` ${d.actualUnit}` : "";
    return `${d.variableName} = ${valStr}${unitStr}`;
  });

  steps.push({
    stepNumber: 1,
    description: "Gather and validate input dependencies",
    expression: inputStrings.join(", "),
    evaluatedValue: null,
  });

  if (missingInputs.length > 0) {
    diagnostics.push(
      `Missing required input values: ${missingInputs.join(", ")}.`
    );
    return {
      targetFieldId: targetId,
      targetVariableName: targetVar,
      formula,
      result: null,
      status: "missing_inputs",
      dependencies,
      steps,
      diagnostics,
      summary: `Calculation pending: missing required inputs (${missingInputs.join(", ")}).`,
    };
  }

  if (invalidUnits.length > 0) {
    diagnostics.push(`Unit mismatch detected: ${invalidUnits.join("; ")}.`);
  }

  // Check denominator division by zero for BMI or fractions
  let isDivZero = false;
  const heightDep = dependencies.find((d) =>
    d.variableName.toUpperCase().includes("HEIGHT")
  );
  if (
    heightDep &&
    (Number(heightDep.value) === 0 || Number(heightDep.value) < 0)
  ) {
    isDivZero = true;
    diagnostics.push(
      `Division by zero: ${heightDep.variableName} is ${heightDep.value}. Height must be positive.`
    );
  }

  // Attempt typed evaluation
  const evalOutcome = parseAndEvaluateFormula(formula, fieldValues, fieldsList);

  if (!evalOutcome.success || evalOutcome.value === null) {
    if (
      !evalOutcome.success &&
      (evalOutcome.error.code === "SYNTAX_ERROR" ||
        evalOutcome.error.code === "UNKNOWN_FUNCTION")
    ) {
      diagnostics.push(
        `Syntax error while parsing formula: ${evalOutcome.error.message}`
      );
      return {
        targetFieldId: targetId,
        targetVariableName: targetVar,
        formula,
        result: null,
        status: "syntax_error",
        dependencies,
        steps,
        diagnostics,
        summary: `Invalid formula syntax: ${evalOutcome.error.message}`,
      };
    }

    if (
      !evalOutcome.success &&
      evalOutcome.error.code === "UNRESOLVED_VARIABLE"
    ) {
      diagnostics.push(evalOutcome.error.message);
      return {
        targetFieldId: targetId,
        targetVariableName: targetVar,
        formula,
        result: null,
        status: "missing_inputs",
        dependencies,
        steps,
        diagnostics,
        summary: `Calculation pending: ${evalOutcome.error.message}.`,
      };
    }

    if (isDivZero) {
      steps.push({
        stepNumber: 2,
        description: "Evaluate denominator",
        expression: `${heightDep?.variableName} = 0 -> Denominator is zero`,
        evaluatedValue: 0,
      });
      return {
        targetFieldId: targetId,
        targetVariableName: targetVar,
        formula,
        result: null,
        status: "division_by_zero",
        dependencies,
        steps,
        diagnostics,
        summary: `Calculation halted: division by zero encountered.`,
      };
    }

    diagnostics.push(
      !evalOutcome.success
        ? evalOutcome.error.message
        : "Evaluation produced null result (possible zero denominator or undefined calculation)."
    );
    return {
      targetFieldId: targetId,
      targetVariableName: targetVar,
      formula,
      result: null,
      status: "division_by_zero",
      dependencies,
      steps,
      diagnostics,
      summary: `Calculation halted: division by zero or undefined operation in formula.`,
    };
  }

  const evalResult = evalOutcome.value;

  // Formula evaluation succeeded - generate clinical derivation steps
  const isBmi =
    formula.toUpperCase().includes("WEIGHT") &&
    formula.toUpperCase().includes("HEIGHT");

  if (isBmi) {
    const wDep = dependencies.find((d) =>
      d.variableName.toUpperCase().includes("WEIGHT")
    );
    const hDep = dependencies.find((d) =>
      d.variableName.toUpperCase().includes("HEIGHT")
    );
    const wVal = Number(wDep?.value || 0);
    const hVal = Number(hDep?.value || 0);
    const hM = hVal / 100;
    const hSq = hM * hM;
    const rawBmi = wVal / hSq;
    const roundedBmi = Math.round(rawBmi * 10) / 10;

    steps.push({
      stepNumber: 2,
      description: "Convert height from centimeters to meters",
      expression: `${hVal} cm / 100 = ${hM.toFixed(2)} m`,
      evaluatedValue: hM,
    });
    steps.push({
      stepNumber: 3,
      description: "Compute squared height in square meters",
      expression: `(${hM.toFixed(2)} m)² = ${hSq.toFixed(4)} m²`,
      evaluatedValue: hSq,
    });
    steps.push({
      stepNumber: 4,
      description: "Divide body weight by squared height",
      expression: `${wVal} kg / ${hSq.toFixed(4)} m² = ${rawBmi.toFixed(4)} kg/m²`,
      evaluatedValue: rawBmi,
    });
    steps.push({
      stepNumber: 5,
      description: "Round result to standard 1 decimal place",
      expression: `round(${rawBmi.toFixed(4)}, 1) = ${roundedBmi.toFixed(1)} kg/m²`,
      evaluatedValue: roundedBmi,
    });
  } else {
    // Generic formula steps
    steps.push({
      stepNumber: 2,
      description: "Evaluate formula expression with resolved inputs",
      expression: formula,
      evaluatedValue: evalResult,
    });
    steps.push({
      stepNumber: 3,
      description: "Computed result",
      expression: `${targetVar} = ${evalResult}`,
      evaluatedValue: evalResult,
    });
  }

  const formattedResult = evalResult !== null ? String(evalResult) : undefined;
  const status = invalidUnits.length > 0 ? "invalid_unit" : "success";
  const summary = `${targetVar} = ${evalResult}${isBmi ? " kg/m²" : ""}`;

  return {
    targetFieldId: targetId,
    targetVariableName: targetVar,
    formula,
    result: evalResult,
    formattedResult,
    status,
    dependencies,
    steps,
    diagnostics,
    summary,
  };
}
