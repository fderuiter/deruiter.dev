import { defineConfig } from "vitest/config";
import path from "path";
import os from "os";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    execArgv: ["--max-old-space-size=4096", "--no-warnings"],
    exclude: ["**/node_modules/**", "**/e2e/**"],
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
        "scripts/**",
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
        "lib/quasi-perfect/types.ts",
        "lib/quasi-perfect/index.ts",
        "lib/garmin-types.ts",
        "lib/working-with-duck-types.ts",
        "lib/telemetry/index.ts",
        "lib/trial-and-error/index.ts",
      ],
      thresholds: {
        "lib/**": {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 70,
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
        "components/**": {
          statements: 60,
        },
        "app/**": {
          statements: 50,
        },
        // Trial & Error validation and scoring carry a stricter gate (#890, #909).
        "lib/trial-and-error/**": {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
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
