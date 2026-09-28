process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = "true";

import { defineConfig } from "vitest/config";
import path from "path";
import os from "os";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30000,
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
      reporter: ["text", "json", "html", "lcov", "json-summary"],
      exclude: [
        "**/node_modules/**",
        "**/e2e/**",
        "app/instrumentation.ts",
        "app/globals.css",
        "sentry.*.config.ts",
        "instrumentation-client.ts",
        "prisma.config.ts",
        "scripts/**",
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
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
        // Core business logic strict threshold enforcement
        "lib/proof-utils.ts": {
          statements: 95,
          branches: 85,
          functions: 90,
          lines: 95,
        },
        "lib/trial-and-error/**": {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        "lib/security.ts": {
          statements: 95,
          branches: 85,
          functions: 90,
          lines: 95,
        },
        // Tiered thresholds for UI components
        "components/**": {
          statements: 65,
          branches: 60,
          functions: 65,
          lines: 65,
        },
        // Tiered thresholds for route pages and layouts
        "app/**": {
          statements: 50,
          branches: 50,
          functions: 50,
          lines: 50,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
