import { defineConfig, type Plugin } from "vitest/config";
import { readFileSync } from "fs";
import path from "path";
import os from "os";

/**
 * #2531: `@tabler/icons-react` has no `exports` map, so Node resolves the
 * bare specifier to its CommonJS bundle, which defines all ~6,000 icons.
 * Loading it cost about 190 ms in each of ~400 test files, the largest
 * single import in the suite. `next build` avoids the same cost through
 * `optimizePackageImports` (`next.config.ts`); this plugin does the
 * equivalent for Vitest by rewriting each named icon import in source and
 * test files to that icon's own ESM module. The name-to-module map is read
 * from the package's ESM entry, so aliases such as `IconMessageCircle2`
 * resolve to the same module the barrel would give, and a name missing from
 * the map stays on the barrel.
 */
const TABLER_IMPORT =
  /import\s*\{([^}]*)\}\s*from\s*["']@tabler\/icons-react["'];?/g;
const TABLER_ESM_DIR = path.resolve(
  import.meta.dirname,
  "node_modules/@tabler/icons-react/dist/esm"
);
let tablerIconModules: Map<string, string> | undefined;

function tablerIconModule(name: string): string | undefined {
  if (!tablerIconModules) {
    tablerIconModules = new Map();
    const barrel = readFileSync(
      path.join(TABLER_ESM_DIR, "tabler-icons-react.mjs"),
      "utf8"
    );
    for (const [, names, file] of barrel.matchAll(
      /export \{([^}]*)\} from '\.\/icons\/(\w+\.mjs)';/g
    )) {
      for (const [, exported] of names.matchAll(/default as (\w+)/g)) {
        tablerIconModules.set(exported, file);
      }
    }
  }
  return tablerIconModules.get(name);
}

function tablerIconsPerIconImports(): Plugin {
  return {
    name: "tabler-icons-per-icon-imports",
    enforce: "pre",
    transform(code, id) {
      if (
        id.includes("/node_modules/") ||
        !code.includes("@tabler/icons-react")
      ) {
        return null;
      }
      let changed = false;
      const next = code.replace(
        TABLER_IMPORT,
        (statement, specifiers: string) => {
          const direct: string[] = [];
          const kept: string[] = [];
          for (const raw of specifiers.split(",")) {
            const specifier = raw.trim();
            if (!specifier) continue;
            const match = /^(Icon\w+)(?:\s+as\s+(\w+))?$/.exec(specifier);
            const file = match && tablerIconModule(match[1]);
            if (match && file) {
              direct.push(
                `import ${match[2] ?? match[1]} from "@tabler/icons-react/dist/esm/icons/${file}";`
              );
            } else {
              kept.push(specifier);
            }
          }
          if (direct.length === 0) return statement;
          changed = true;
          const rest = kept.length
            ? `import { ${kept.join(", ")} } from "@tabler/icons-react";`
            : "";
          // Keep the statement's line count so later source positions, and
          // the coverage report mapped from them, do not move.
          const newlines = statement.split("\n").length - 1;
          return (
            [...direct, rest].filter(Boolean).join(" ") + "\n".repeat(newlines)
          );
        }
      );
      return changed ? { code: next, map: null } : null;
    },
  };
}

/**
 * #1775: CI runs the suite as three shards, each writing a blob report, and
 * a follow-up job merges them (`npm run test:ci:merge`). A shard covers a
 * third of the files, so it cannot meet thresholds meant for the whole
 * suite; `npm run test:ci:shard` sets this variable to defer them to the
 * merge, which applies exactly the thresholds below to the combined
 * coverage. Every other run, local or CI, enforces them directly.
 */
const coverageThresholdsDeferred =
  process.env.VITEST_COVERAGE_THRESHOLDS === "deferred-to-merge";

export default defineConfig({
  plugins: [tablerIconsPerIconImports()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    execArgv: ["--max-old-space-size=4096", "--no-warnings"],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.stryker-tmp/**"],
    // Vitest defaults threads.maxThreads to (cpus - 1). On small runners
    // that oversubscribes the machine once each worker's own libuv/GC
    // helper threads are counted, which starves CPU-heavy synchronous
    // render tests (e.g. crf-studio.test.tsx, which mounts 9 real
    // components and drives 5 sequential act() cycles) — they finish in
    // well under a second in isolation but can exceed their timeout
    // under full-suite contention. Halving the worker count trades some
    // wall-clock time for each worker actually getting scheduled.
    maxWorkers: Math.max(1, Math.floor(os.cpus().length / 2)),
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "**/node_modules/**",
        "**/e2e/**",
        "components/neuro/Brain3DViewer.tsx",
        "app/instrumentation.ts",
        "app/globals.css",
        "lib/dx/utils.ts",
        "sentry.*.config.ts",
        "instrumentation-client.ts",
        "prisma.config.ts",
        "scripts/**/*.sh",
        "scripts/**/*.json",
        "scripts/!(migration-replay.ts|vercel-production-preflight.js)",
        "lib/layout-config.ts",
        "hooks/usePretextLayout.tsx",
        "lib/utils.ts",
        "components/providers/SearchProvider.tsx",
        "hooks/useResizeObserver.ts",
        "app/generated/**",
        "vitest.setup.ts",
        "lib/dx/page-bench.ts",
        "lib/dungeon/types.ts",
        "lib/dungeon/index.ts",
        "lib/laser-loon/types.ts",
        "lib/laser-loon/index.ts",
        "lib/clinical-trial-chaos/types.ts",
        "lib/clinical-platform/types.ts",
        "lib/clinical-platform/index.ts",
        "lib/quasi-perfect/types.ts",
        "lib/quasi-perfect/index.ts",
        "lib/garmin-types.ts",
        "lib/working-with-duck-types.ts",
        "lib/telemetry/index.ts",
        "lib/trial-and-error/index.ts",
        "lib/study-data/types.ts",
        "lib/study-data/index.ts",
        "lib/proof/index.ts",
      ],
      thresholds: coverageThresholdsDeferred
        ? undefined
        : {
            "lib/**": {
              lines: 80,
              functions: 80,
              statements: 80,
              branches: 70,
            },
            // #2607: set just below the study data suites' measured
            // coverage (2026-10-24: 96.2/86.8/99.6/96.8). Fred chose a
            // ratchet over the 95% branch target: raise it as tests for
            // real derivation risks land; never lower it.
            "lib/study-data/**": {
              statements: 96,
              branches: 86,
              functions: 99,
              lines: 96,
            },
            "hooks/**": {
              lines: 80,
              functions: 80,
              statements: 80,
              branches: 70,
            },
            "proxy.ts": {
              lines: 80,
              functions: 80,
              statements: 80,
              branches: 70,
            },
            // UI floors ratchet: set just below the coverage measured on
            // main (2026-10-20, after the studio splits in #2530: components
            // 83.9/79.7/85.4/79.6, app 88.9/81.0/89.1/79.8
            // statements/branches/lines/functions). Raise them as coverage
            // grows; never lower them (#2513).
            "components/**": {
              statements: 83,
              branches: 78,
              lines: 84,
              functions: 78,
            },
            "app/**": {
              statements: 88,
              branches: 80,
              lines: 88,
              functions: 79,
            },
            // Trial & Error validation and scoring carry a stricter gate (#890, #909).
            "lib/trial-and-error/**": {
              statements: 95,
              branches: 95,
              functions: 95,
              lines: 95,
            },
            "scripts/**": {
              lines: 80,
              functions: 80,
            },
          },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
});
