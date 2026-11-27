import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { DiagnosticCheckResult } from "../doctor";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  ".claude",
  ".stryker-tmp",
]);

function walkTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        results.push(...walkTsFiles(path.join(dir, entry.name)));
      }
    } else if (
      /\.(?:ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
    ) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return Boolean(
    modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function getLineNumber(sourceFile: ts.SourceFile, node: ts.Node): number {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  );
}

function typeNodeReferencesResultEnvelope(
  typeNode: ts.TypeNode | undefined,
  sourceFile: ts.SourceFile
): boolean {
  if (!typeNode) return false;
  const text = typeNode.getText(sourceFile);
  return /\b(?:ServiceResult|[A-Z][A-Za-z0-9]*Result)\b/.test(text);
}

function isInsideTryBlock(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isTryStatement(current.parent) &&
      current.parent.tryBlock === current
    ) {
      return true;
    }
    if (ts.isMethodDeclaration(current) || ts.isFunctionDeclaration(current)) {
      return false;
    }
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      // Async callback passed to an awaited call (e.g. await prisma.$transaction(async (tx) => ...))
      // propagates rejections to the outer call expression; keep walking if parent is CallExpression.
      if (!current.parent || !ts.isCallExpression(current.parent)) {
        return false;
      }
    }
    current = current.parent;
  }
  return false;
}

function isLoggerErrorOrWarnCall(node: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  const methodName = node.expression.name.text;
  if (methodName !== "error" && methodName !== "warn") return false;
  const receiver = node.expression.expression;
  if (ts.isIdentifier(receiver)) {
    return receiver.text === "logger" || receiver.text.endsWith("Logger");
  }
  if (ts.isPropertyAccessExpression(receiver)) {
    return (
      receiver.name.text === "logger" || receiver.name.text.endsWith("Logger")
    );
  }
  return false;
}

function findSanitizeErrorCallInNode(node: ts.Node): ts.CallExpression | null {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "sanitizeError"
  ) {
    return node;
  }
  let found: ts.CallExpression | null = null;
  ts.forEachChild(node, (child) => {
    if (!found) {
      found = findSanitizeErrorCallInNode(child);
    }
  });
  return found;
}

export interface ServiceContractViolation {
  file: string;
  line: number;
  issue: string;
}

/**
 * Inspects service contracts, vertical slice structure, throw and await boundaries,
 * and logger error-sanitization boundaries using the TypeScript compiler AST.
 *
 * @param root - Workspace root directory.
 * @returns List of detected architectural contract violations.
 */
export function findServiceContractViolations(
  root: string
): ServiceContractViolation[] {
  const violations: ServiceContractViolation[] = [];
  const servicesDir = path.join(root, "lib", "services");

  if (fs.existsSync(servicesDir)) {
    const domainEntries = fs
      .readdirSync(servicesDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const domainEntry of domainEntries) {
      if (!domainEntry.isDirectory() || IGNORED_DIRS.has(domainEntry.name)) {
        continue;
      }
      const domainDir = path.join(servicesDir, domainEntry.name);

      const opEntries = fs
        .readdirSync(domainDir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const opEntry of opEntries) {
        if (!opEntry.isDirectory() || IGNORED_DIRS.has(opEntry.name)) {
          continue;
        }
        const opDir = path.join(domainDir, opEntry.name);
        const specPath = path.join(opDir, "spec.ts");
        const handlerPath = path.join(opDir, "handler.ts");
        if (!fs.existsSync(specPath)) {
          violations.push({
            file: path.relative(root, opDir),
            line: 1,
            issue:
              "Vertical slice directory is missing spec.ts (every operation directory requires paired spec.ts and handler.ts).",
          });
        }
        if (!fs.existsSync(handlerPath)) {
          violations.push({
            file: path.relative(root, opDir),
            line: 1,
            issue:
              "Vertical slice directory is missing handler.ts (every operation directory requires paired spec.ts and handler.ts).",
          });
        }
      }
    }

    const serviceFiles = walkTsFiles(servicesDir).filter(
      (file) => !file.includes(".test.") && !file.includes(".spec.")
    );

    for (const file of serviceFiles) {
      const relative = path.relative(root, file);
      const relativeSegments = relative.split(path.sep);
      const isTwoLevelVerticalSlice = relativeSegments.length >= 5;
      const baseName = path.basename(file);
      const content = fs.readFileSync(file, "utf-8");
      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true
      );
      const fileViolations: ServiceContractViolation[] = [];

      if (baseName === "spec.ts") {
        let exportedSpecInterface: ts.InterfaceDeclaration | undefined;
        for (const stmt of sourceFile.statements) {
          if (
            ts.isInterfaceDeclaration(stmt) &&
            hasExportModifier(stmt) &&
            stmt.name.text.endsWith("Spec")
          ) {
            exportedSpecInterface = stmt;
            break;
          }
        }
        if (!exportedSpecInterface) {
          fileViolations.push({
            file: relative,
            line: 1,
            issue:
              "spec.ts must export a *Spec interface declaring execute(input) returning ServiceResult.",
          });
        } else {
          const executeMember = exportedSpecInterface.members.find(
            (m): m is ts.MethodSignature =>
              ts.isMethodSignature(m) &&
              m.name !== undefined &&
              m.name.getText(sourceFile) === "execute"
          );
          if (
            !executeMember ||
            !typeNodeReferencesResultEnvelope(executeMember.type, sourceFile)
          ) {
            fileViolations.push({
              file: relative,
              line: getLineNumber(sourceFile, exportedSpecInterface),
              issue: `${exportedSpecInterface.name.text}.execute must declare a typed ServiceResult return envelope.`,
            });
          }
        }
      }

      if (baseName === "handler.ts") {
        let exportedHandlerClass: ts.ClassDeclaration | undefined;
        for (const stmt of sourceFile.statements) {
          if (
            ts.isClassDeclaration(stmt) &&
            hasExportModifier(stmt) &&
            stmt.name?.text.endsWith("Handler")
          ) {
            exportedHandlerClass = stmt;
            break;
          }
        }
        if (!exportedHandlerClass || !exportedHandlerClass.name) {
          fileViolations.push({
            file: relative,
            line: 1,
            issue:
              "handler.ts must export a *Handler class implementing its paired *Spec interface.",
          });
        } else {
          const hasPairedSpec =
            isTwoLevelVerticalSlice ||
            fs.existsSync(path.join(path.dirname(file), "spec.ts"));
          if (hasPairedSpec) {
            const implementsSpec = exportedHandlerClass.heritageClauses?.some(
              (clause) =>
                clause.token === ts.SyntaxKind.ImplementsKeyword &&
                clause.types.some((t) =>
                  t.expression.getText(sourceFile).endsWith("Spec")
                )
            );
            if (!implementsSpec) {
              fileViolations.push({
                file: relative,
                line: getLineNumber(sourceFile, exportedHandlerClass),
                issue: `${exportedHandlerClass.name.text} must implement its *Spec contract interface.`,
              });
            }
          }

          const executeMethod = exportedHandlerClass.members.find(
            (m): m is ts.MethodDeclaration =>
              ts.isMethodDeclaration(m) &&
              m.name !== undefined &&
              m.name.getText(sourceFile) === "execute"
          );
          if (
            !executeMethod ||
            !typeNodeReferencesResultEnvelope(executeMethod.type, sourceFile)
          ) {
            fileViolations.push({
              file: relative,
              line: getLineNumber(
                sourceFile,
                executeMethod ?? exportedHandlerClass
              ),
              issue: `${exportedHandlerClass.name.text}.execute must declare an explicit ServiceResult return type annotation.`,
            });
          }
        }
      }

      const visitServiceAst = (node: ts.Node): void => {
        if (ts.isThrowStatement(node)) {
          const isRethrow =
            node.expression !== undefined && ts.isIdentifier(node.expression);
          fileViolations.push({
            file: relative,
            line: getLineNumber(sourceFile, node),
            issue: `${isRethrow ? "Caught error rethrown" : "Raw exception thrown"} across the service boundary (${node.getText(sourceFile).trim()}). Return a ServiceResult createFailure() envelope instead.`,
          });
        }

        if (baseName === "handler.ts" && ts.isAwaitExpression(node)) {
          if (!isInsideTryBlock(node)) {
            fileViolations.push({
              file: relative,
              line: getLineNumber(sourceFile, node),
              issue: `Unguarded await expression in handler.ts (${node.getText(sourceFile).slice(0, 60).trim()}). Wrap I/O awaits in try/catch and return createFailure().`,
            });
          }
        }

        ts.forEachChild(node, visitServiceAst);
      };

      visitServiceAst(sourceFile);

      if (baseName.endsWith("-service.ts") && fileViolations.length === 0) {
        fileViolations.push({
          file: relative,
          line: 1,
          issue:
            "Legacy *-service.ts monolith detected in lib/services/. Decompose into vertical slices with paired spec.ts and handler.ts.",
        });
      }

      violations.push(...fileViolations);
    }
  }

  const scanRoots = ["app", "components", "hooks", "lib", "scripts"];
  for (const dirName of scanRoots) {
    const targetDir = path.join(root, dirName);
    for (const file of walkTsFiles(targetDir)) {
      if (file.includes(".test.") || file.includes(".spec.")) continue;
      const relative = path.relative(root, file);
      const content = fs.readFileSync(file, "utf-8");
      if (!content.includes("sanitizeError")) continue;
      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true
      );
      const visitLoggerCalls = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && isLoggerErrorOrWarnCall(node)) {
          for (const arg of node.arguments) {
            const sanitizeCall = findSanitizeErrorCallInNode(arg);
            if (sanitizeCall) {
              violations.push({
                file: relative,
                line: getLineNumber(sourceFile, sanitizeCall),
                issue:
                  "Caller-side sanitizeError() passed to logger.error or logger.warn strips multi-frame stack traces before Sentry capture.",
              });
            }
          }
        }
        ts.forEachChild(node, visitLoggerCalls);
      };
      visitLoggerCalls(sourceFile);
    }
  }

  return violations;
}

/**
 * Check Typed Service Contracts and Result Envelopes Guard (ADR-0028).
 *
 * @param root - Workspace root directory.
 * @param _fix - Unused autofix flag for DiagnosticCheckResult signature parity.
 * @returns Diagnostic check result.
 */
export function checkServiceResultTypes(
  root: string,
  _fix = false
): DiagnosticCheckResult {
  const servicesDir = path.join(root, "lib", "services");
  const hasAnyScanTarget =
    fs.existsSync(servicesDir) ||
    ["app", "components", "hooks", "lib", "scripts"].some((dir) =>
      fs.existsSync(path.join(root, dir))
    );

  if (!hasAnyScanTarget) {
    return {
      id: "architecture-service-result-types",
      name: "Typed Service Contracts & Result Envelopes Guard (ADR-0028)",
      category: "architecture",
      status: "pass",
      message: "lib/services/ directory not present (skipped).",
    };
  }

  const violations = findServiceContractViolations(root);

  if (violations.length === 0) {
    return {
      id: "architecture-service-result-types",
      name: "Typed Service Contracts & Result Envelopes Guard (ADR-0028)",
      category: "architecture",
      status: "pass",
      message:
        "All service vertical slices implement *Spec contracts, return typed ServiceResult envelopes without throws or unguarded awaits, and preserve raw Error stacks at logger boundaries.",
    };
  }

  return {
    id: "architecture-service-result-types",
    name: "Typed Service Contracts & Result Envelopes Guard (ADR-0028)",
    category: "architecture",
    status: "fail",
    message: `${violations.length} service contract or error boundary violation(s) detected. (ADR-0028: Typed Service Contracts, Dual-Seam Architecture, and Shoehorn Test Fixture Hygiene)`,
    details: violations.map((v) => `${v.file}:${v.line} -> ${v.issue}`),
    fixable: false,
  };
}
