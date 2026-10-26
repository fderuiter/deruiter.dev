import fs from "fs";
import path from "path";
import type { DiagnosticCheckResult } from "./doctor";

/**
 * The three-view guardrails (#2845, ADR 0062). A game is one session with a
 * desktop, a tablet and a phone view; these checks keep it that way, so a
 * phone branch never creeps back into a session, an engine or a view.
 *
 * - Every registry game declares all three views, and a gated view names the
 *   game's three-view epic (`epic` in `lib/arcade/registry.ts`).
 * - A file under `components/<game>/views/` never imports another view.
 * - Sessions, engines and views never read the device: no `usePhone`,
 *   `useCabinetTouch`, `useTouchDevice`, `matchMedia` or width media query.
 *   The cabinet picks the view; a view lays out for the one it is.
 * - Phone views set no text under 12px.
 * - A cabinet with views takes its control list from the game's action map,
 *   never an inline list.
 */

/** Device reads a session, an engine or a view must not make. */
const DEVICE_READS: ReadonlyArray<{
  readonly name: string;
  readonly pattern: RegExp;
}> = [
  { name: "usePhone", pattern: /\busePhone\b/ },
  { name: "useCabinetTouch", pattern: /\buseCabinetTouch\b/ },
  { name: "useTouchDevice", pattern: /\buseTouchDevice\b/ },
  { name: "matchMedia", pattern: /\bmatchMedia\b/ },
  {
    name: "a width media query",
    pattern: /\((?:min|max)-(?:device-)?width\s*:/,
  },
];

/** Text sizes under the phone floor (AGENTS.md §16, ADR 0061). */
const SUB_FLOOR_TEXT = /\btext-\[(?:9|10|11)px\]/;

/**
 * Engines that do not live at `lib/<slug>/`. A game whose engine is there
 * needs no entry.
 */
const ENGINE_PATHS: Readonly<Record<string, readonly string[]>> = {
  "retro-labyrinth": ["lib/retro-labyrinth", "lib/dungeon"],
  "clinical-chaos": ["lib/clinical-trial-chaos"],
  "garmin-watch": ["lib/garmin"],
  "quasi-puzzler": ["lib/quasi-perfect"],
  "working-with-duck": [
    "lib/working-with-duck-engine.ts",
    "lib/working-with-duck-actions.ts",
  ],
};

/**
 * Files that still break a device-read or view rule, each with the epic
 * that moves it onto its views. Remove a row when that work lands; a row
 * whose file is gone or clean is reported, so the list cannot go stale.
 */
export const THREE_VIEW_ALLOWLIST: Readonly<Record<string, number>> = {
  // The phone view reads the cabinet's touch state: a phone-sized window
  // worked with a mouse keeps the desktop controls (#2917, #2968).
  "components/retro-labyrinth/views/PhoneView.tsx": 2375,
};

/** One game's registry entry, as the guard reads it from source. */
interface RegistryEntrySource {
  readonly slug: string;
  readonly views: Partial<Record<"desktop" | "tablet" | "phone", string>>;
  readonly epic?: number;
}

function read(root: string, file: string): string {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf-8") : "";
}

function filesUnder(root: string, dir: string, pattern: RegExp): string[] {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return pattern.test(dir) ? [dir] : [];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(root, rel, pattern);
    return pattern.test(entry.name) ? [rel] : [];
  });
}

function parseViews(
  text: string
): Partial<Record<"desktop" | "tablet" | "phone", string>> {
  const views: Partial<Record<"desktop" | "tablet" | "phone", string>> = {};
  for (const match of text.matchAll(
    /\b(desktop|tablet|phone):\s*"([a-z]+)"/g
  )) {
    views[match[1] as "desktop" | "tablet" | "phone"] = match[2];
  }
  return views;
}

/** Reads each game's views and epic from `lib/arcade/registry.ts`. */
function readRegistry(source: string): RegistryEntrySource[] {
  const list = source.split(/export const ARCADE_REGISTRY\b/)[1] ?? "";
  return Array.from(
    list.matchAll(/\{\s*slug:\s*"([^"]+)"([\s\S]*?)\n {2}\}/g),
    (match) => {
      const body = match[2];
      const viewsRef = /\bviews:\s*([A-Z_][A-Z0-9_]*|\{[^}]*\})/.exec(body);
      let views: RegistryEntrySource["views"] = {};
      if (viewsRef?.[1].startsWith("{")) {
        views = parseViews(viewsRef[1]);
      } else if (viewsRef) {
        const constant = new RegExp(
          `const ${viewsRef[1]}\\b[^=]*=\\s*(\\{[^}]*\\})`
        ).exec(source);
        views = constant ? parseViews(constant[1]) : {};
      }
      const epic = /\bepic:\s*(\d+)/.exec(body);
      return {
        slug: match[1],
        views,
        epic: epic ? Number(epic[1]) : undefined,
      };
    }
  );
}

/** Whether an import specifier reaches into a game's `views/` folder. */
function importsAView(specifier: string): boolean {
  // The shared cabinet plumbing (`defineGameViews`) is not a game's view.
  if (specifier.startsWith("@/components/arcade/views")) return false;
  if (/(^|\/)views\//.test(specifier)) return true;
  // Inside a views folder, a sibling file is another view.
  return /^\.\/[^/]+$/.test(specifier);
}

/**
 * Checks the three-view guardrails over the workspace at `root`.
 *
 * @param root - The workspace root.
 * @returns The Doctor result, failing with one detail per violation.
 */
export function checkArcadeThreeViews(root: string): DiagnosticCheckResult {
  const base = {
    id: "arcade-three-view-guardrails",
    name: "Arcade Three-View Guardrails",
    category: "architecture" as const,
  };
  const registry = readRegistry(read(root, "lib/arcade/registry.ts"));
  if (registry.length === 0) {
    return {
      ...base,
      status: "fail",
      message: "No games found in lib/arcade/registry.ts.",
      fixable: false,
    };
  }

  const details: string[] = [];
  const allowed = new Set<string>();

  for (const game of registry) {
    for (const view of ["desktop", "tablet", "phone"] as const) {
      const readiness = game.views[view];
      if (readiness !== "ready" && readiness !== "gated") {
        details.push(
          `${game.slug} declares no ${view} view in lib/arcade/registry.ts.`
        );
      }
    }
    const gated = Object.entries(game.views)
      .filter(([, readiness]) => readiness === "gated")
      .map(([view]) => view);
    if (gated.length > 0 && game.epic === undefined) {
      details.push(
        `${game.slug} gates its ${gated.join(" and ")} view with no epic; set \`epic\` to the issue that ships it.`
      );
    }
  }

  const viewFiles = filesUnder(root, "components", /\.tsx?$/).filter(
    (file) =>
      /\/views\//.test(file) && !file.startsWith("components/arcade/views/")
  );
  const sessionFiles = filesUnder(root, "components", /Session\.tsx?$/).filter(
    (file) => !file.startsWith("components/arcade/")
  );
  const engineFiles = registry.flatMap((game) =>
    (ENGINE_PATHS[game.slug] ?? [`lib/${game.slug}`]).flatMap((dir) =>
      filesUnder(root, dir, /\.tsx?$/)
    )
  );

  const report = (file: string, problem: string) => {
    if (file in THREE_VIEW_ALLOWLIST) {
      allowed.add(file);
      return;
    }
    details.push(`${file}: ${problem}`);
  };

  for (const file of [
    ...new Set([...viewFiles, ...sessionFiles, ...engineFiles]),
  ]) {
    const source = read(root, file);
    const kind = viewFiles.includes(file)
      ? "view"
      : sessionFiles.includes(file)
        ? "session"
        : "engine";
    for (const deviceRead of DEVICE_READS) {
      if (deviceRead.pattern.test(source)) {
        report(
          file,
          `${kind === "engine" ? "an" : "a"} ${kind} reads the device (${deviceRead.name}); the cabinet picks the view.`
        );
      }
    }
    if (kind !== "view") continue;
    for (const match of source.matchAll(
      /\bfrom\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g
    )) {
      const specifier = match[1] ?? match[2];
      if (importsAView(specifier)) {
        report(file, `a view imports another view (${specifier}).`);
      }
    }
    if (/\/views\/Phone[^/]*\.tsx$/.test(file) && SUB_FLOOR_TEXT.test(source)) {
      report(file, "a phone view sets text under 12px.");
    }
  }

  for (const file of filesUnder(root, "components", /Client\.tsx$/)) {
    const source = read(root, file);
    if (!/\bviews=\{/.test(source)) continue;
    if (/\bcontrols=\{\s*\[\s*\{/.test(source)) {
      details.push(
        `${file}: a cabinet with views lists its controls inline; pass controlsFromActions(<the game's action map>).`
      );
    }
  }

  for (const [file, epic] of Object.entries(THREE_VIEW_ALLOWLIST)) {
    if (!allowed.has(file) && fs.existsSync(path.join(root, file))) {
      details.push(
        `${file} is allow-listed (#${epic}) but no longer breaks a rule; remove its THREE_VIEW_ALLOWLIST row.`
      );
    }
  }

  if (details.length === 0) {
    return {
      ...base,
      status: "pass",
      message: `${registry.length} games declare three views; sessions, engines and views read no device${allowed.size > 0 ? ` (${allowed.size} allow-listed file(s) pending their epic)` : ""}.`,
    };
  }
  return {
    ...base,
    status: "fail",
    message: `${details.length} three-view guardrail violation(s) (ADR 0062).`,
    details,
    fixable: false,
  };
}
