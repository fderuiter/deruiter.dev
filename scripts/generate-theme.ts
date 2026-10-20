import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ThemeGenerationOptions {
  sourceRoot?: string;
  outputPath?: string;
}

function parseNumber(value: string, name: string): number {
  const numberValue = Number.parseFloat(value);
  if (Number.isNaN(numberValue)) {
    throw new Error(
      `Malformed token value for ${name}: ${value} is not a number.`
    );
  }
  return numberValue;
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  );
}

interface TokenEntry {
  key: string;
  cssVar: string;
  value: number | string;
}

interface SpringEntry {
  type: "spring";
  stiffness?: number;
  damping?: number;
}

/** Renders a token value as the TypeScript literal it is declared with. */
function literal(value: number | string): string {
  return typeof value === "number" ? String(value) : JSON.stringify(value);
}

/**
 * Renders one annotated property, preserving the CSS variable each token was
 * compiled from so the generated manifest stays self-documenting for TypeDoc.
 */
function annotatedProperty(
  entry: TokenEntry,
  indent: string,
  quoteKey: boolean
): string {
  const name = quoteKey ? JSON.stringify(entry.key) : entry.key;
  return [
    `${indent}/** Original CSS Variable: --${entry.cssVar} */`,
    `${indent}${name}: ${literal(entry.value)},`,
  ].join("\n");
}

/** Renders an annotated token block as the body of an object literal. */
function annotatedBlock(
  entries: TokenEntry[],
  indent: string,
  quoteKeys: boolean
): string {
  return entries
    .map((entry) => annotatedProperty(entry, indent, quoteKeys))
    .join("\n");
}

/** Compiles :root design tokens into the runtime TypeScript manifest. */
export function generateTheme({
  sourceRoot = process.cwd(),
  outputPath = path.resolve(sourceRoot, "lib/design-manifest.ts"),
}: ThemeGenerationOptions = {}): string {
  const cssPath = path.resolve(sourceRoot, "app/globals.css");
  const css = fs.readFileSync(cssPath, "utf8");
  const rootMatch = css.match(/:root\s*{([^}]+)}/);

  if (!rootMatch) {
    throw new Error(`Could not find a :root block in ${cssPath}.`);
  }

  const tokens: Record<string, string> = {};
  const variablePattern = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = variablePattern.exec(rootMatch[1])) !== null) {
    tokens[match[1]] = match[2].trim();
  }

  const colorKeys = [
    "background",
    "foreground",
    "surface-1",
    "surface-2",
    "border",
    "border-active",
    "muted",
    "muted-strong",
    "text-secondary",
    "brand-cyan",
    "emerald-accent",
    "badge-muted-bg",
    "badge-muted-text",
    "brand-blue",
    "brand-dark",
    "success",
    "error",
    "warning",
    "accent",
  ];
  const colors: TokenEntry[] = colorKeys.flatMap((key) =>
    tokens[key] ? [{ key, cssVar: key, value: tokens[key] }] : []
  );
  const masonry: TokenEntry[] = [];
  const layout: TokenEntry[] = [];
  const breakpoints: TokenEntry[] = [];
  const spacing: TokenEntry[] = [];
  const springs = new Map<string, SpringEntry>();

  for (const [key, value] of Object.entries(tokens)) {
    if (key.startsWith("layout-masonry-")) {
      masonry.push({
        key: toCamelCase(key.replace("layout-masonry-", "")),
        cssVar: key,
        value: parseNumber(value, key),
      });
    } else if (key.startsWith("layout-")) {
      const numberValue = Number.parseFloat(value);
      layout.push({
        key: toCamelCase(key.replace("layout-", "")),
        cssVar: key,
        value:
          !Number.isNaN(numberValue) && /^[0-9.]+(px|rem|em)?$/.test(value)
            ? numberValue
            : value,
      });
    } else if (/^space-\d+$/.test(key)) {
      spacing.push({
        key: key.replace("space-", ""),
        cssVar: key,
        value: parseNumber(value, key),
      });
    } else if (key.startsWith("breakpoint-")) {
      breakpoints.push({
        key: key.replace("breakpoint-", ""),
        cssVar: key,
        value: parseNumber(value, key),
      });
    } else if (key.startsWith("motion-spring-")) {
      const springMatch = key.match(/^motion-spring-(.+)-(stiffness|damping)$/);
      if (springMatch) {
        const [, name, property] = springMatch;
        const springKey = toCamelCase(name);
        const spring = springs.get(springKey) ?? { type: "spring" as const };
        if (property === "stiffness") {
          spring.stiffness = parseNumber(value, key);
        } else {
          spring.damping = parseNumber(value, key);
        }
        springs.set(springKey, spring);
      }
    }
  }

  const fontSize = parseNumber(tokens["font-size-sm"] ?? "13", "font-size-sm");
  const lineHeight = parseNumber(
    tokens["line-height-sm"] ?? "18",
    "line-height-sm"
  );

  const springLines = [...springs.entries()].map(([name, spring]) => {
    const fields = [`type: "spring"`];
    if (spring.stiffness !== undefined) {
      fields.push(`stiffness: ${spring.stiffness}`);
    }
    if (spring.damping !== undefined) {
      fields.push(`damping: ${spring.damping}`);
    }
    return `      ${name}: { ${fields.join(", ")} },`;
  });

  const manifest = [
    "/**",
    " * AUTO-GENERATED DESIGN TOKENS",
    " * Do not edit this file directly. Edit app/globals.css instead.",
    " */",
    "",
    "export const designManifest = {",
    "  colors: {",
    annotatedBlock(colors, "    ", true),
    "  },",
    "  typography: {",
    "    fonts: {",
    "      /** Font stack for sans-serif */",
    `      sans: ${JSON.stringify(
      "var(--font-atkinson), system-ui, -apple-system, sans-serif"
    )},`,
    "      /** Font stack for heading */",
    `      heading: ${JSON.stringify(
      "var(--font-lexend), system-ui, -apple-system, sans-serif"
    )},`,
    "      /** Font stack for monospace */",
    `      mono: ${JSON.stringify(
      "var(--font-geist-mono), ui-monospace, monospace"
    )},`,
    "    },",
    "    sizes: {",
    "      sm: {",
    "        /** Original CSS Variable: --font-size-sm */",
    `        fontSize: ${fontSize},`,
    "        /** Original CSS Variable: --line-height-sm */",
    `        lineHeight: ${lineHeight},`,
    "      }",
    "    }",
    "  },",
    "  masonry: {",
    annotatedBlock(masonry, "    ", false),
    "  },",
    "  layout: {",
    annotatedBlock(layout, "    ", false),
    "  },",
    "  spacing: {",
    annotatedBlock(spacing, "    ", true),
    "  },",
    "  breakpoints: {",
    annotatedBlock(breakpoints, "    ", true),
    "  },",
    "  motion: {",
    "    springs: {",
    ...springLines,
    "    }",
    "  }",
    "} as const;",
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (
    !fs.existsSync(outputPath) ||
    fs.readFileSync(outputPath, "utf8") !== manifest
  ) {
    fs.writeFileSync(outputPath, manifest, "utf8");
  }

  return manifest;
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  try {
    const sourceRoot = readFlag("--source-root") ?? process.cwd();
    const outputPath = readFlag("--output");
    generateTheme({
      sourceRoot,
      ...(outputPath ? { outputPath: path.resolve(outputPath) } : {}),
    });
    console.log(
      `Generated TS constants at ${outputPath ?? path.resolve(sourceRoot, "lib/design-manifest.ts")}`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
