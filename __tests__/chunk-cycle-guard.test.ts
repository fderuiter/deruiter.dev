// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  ChunkCycleGuardPlugin,
  WEBPACK_RUNTIME_CHUNK_CYCLE_WARNING,
  analyzeRuntimeChunkCycles,
  findRuntimeChunkCycles,
  formatRuntimeChunkCycles,
  type ChunkCycleChunkLike,
  type ChunkCycleCompilationLike,
  type ChunkCycleCompilerLike,
  type ChunkCycleEntrypointLike,
  type ChunkCycleModuleLike,
} from "../lib/dx/chunk-cycle-guard";

const root = path.resolve(process.cwd());

function fakeModule(resource: string): ChunkCycleModuleLike {
  return {
    identifier: () => `next-swc-loader!${resource}`,
    nameForCondition: () => resource,
  };
}

interface FakeChunk extends ChunkCycleChunkLike {
  referenced: ChunkCycleEntrypointLike[];
  entryModules: ChunkCycleModuleLike[];
}

function fakeChunk(
  label: { name?: string; id?: number },
  runtime = true
): FakeChunk {
  const chunk: FakeChunk = {
    name: label.name ?? null,
    id: label.id ?? null,
    referenced: [],
    entryModules: [],
    hasRuntime: () => runtime,
    getAllReferencedAsyncEntrypoints: () => chunk.referenced,
  };
  return chunk;
}

function fakeCompilation(
  chunks: FakeChunk[],
  warnings: Array<{ message: string }> = []
): ChunkCycleCompilationLike & { sealHooks: Array<() => void> } {
  const sealHooks: Array<() => void> = [];
  return {
    chunks,
    chunkGraph: {
      getChunkEntryModulesIterable: (chunk) =>
        (chunk as FakeChunk).entryModules,
    },
    warnings,
    errors: [],
    sealHooks,
    hooks: {
      afterSeal: { tap: (_name, callback) => sealHooks.push(callback) },
    },
  };
}

/**
 * The shape reported in #853: the client runtime chunk "webpack" can start the
 * mesh worker, and the worker's chunk bundled mesh-generator.ts, which
 * constructs that same worker, so the worker's chunk could start itself.
 */
function issue853Chunks(workerImportsConstructor: boolean): FakeChunk[] {
  const context = root;
  const main = fakeChunk({ name: "webpack" });
  const worker = fakeChunk({ id: 9010 });
  worker.entryModules = [fakeModule(`${context}/lib/neuro/mesh-worker.ts`)];

  const workerEntrypoint: ChunkCycleEntrypointLike = {
    name: null,
    chunks: [worker],
    origins: [{ module: fakeModule(`${context}/lib/neuro/mesh-generator.ts`) }],
  };
  main.referenced = [workerEntrypoint];
  if (workerImportsConstructor) {
    worker.referenced = [workerEntrypoint];
  }
  return [main, worker];
}

describe("chunk-level circular dependency gate (#853)", () => {
  describe("findRuntimeChunkCycles", () => {
    it("returns nothing for an acyclic runtime chunk graph", () => {
      const graph = new Map([
        ["webpack", ["9010", "8404"]],
        ["9010", []],
        ["8404", []],
      ]);
      expect(findRuntimeChunkCycles(graph)).toEqual([]);
    });

    it("reports a chunk that references its own async entrypoint", () => {
      const graph = new Map([
        ["webpack", ["9010"]],
        ["9010", ["9010"]],
      ]);
      expect(findRuntimeChunkCycles(graph)).toEqual([["9010"]]);
    });

    it("reports a multi-chunk cycle once, without the chunks that merely reach it", () => {
      const graph = new Map([
        ["main", ["a"]],
        ["a", ["b"]],
        ["b", ["c"]],
        ["c", ["a"]],
      ]);
      expect(findRuntimeChunkCycles(graph)).toEqual([["a", "b", "c"]]);
    });

    it("reports independent cycles separately and deterministically", () => {
      const graph = new Map([
        ["z", ["y"]],
        ["y", ["z"]],
        ["b", ["a"]],
        ["a", ["b"]],
      ]);
      expect(findRuntimeChunkCycles(graph)).toEqual([
        ["a", "b"],
        ["y", "z"],
      ]);
    });
  });

  describe("analyzeRuntimeChunkCycles", () => {
    it("names the #853 cycle: the mesh worker chunk starting itself", () => {
      const cycles = analyzeRuntimeChunkCycles(
        fakeCompilation(issue853Chunks(true)),
        root
      );
      expect(cycles).toEqual([
        {
          chunks: ["9010"],
          entryModules: { "9010": ["lib/neuro/mesh-worker.ts"] },
          edges: [
            { from: "9010", to: "9010", via: ["lib/neuro/mesh-generator.ts"] },
          ],
        },
      ]);

      const message = formatRuntimeChunkCycles(cycles);
      expect(message).toContain("Cycle 1: 9010");
      expect(message).toContain("chunk 9010: entry lib/neuro/mesh-worker.ts");
      expect(message).toContain("9010 -> 9010 via lib/neuro/mesh-generator.ts");
    });

    it("finds no cycle once the worker no longer imports its constructor", () => {
      expect(
        analyzeRuntimeChunkCycles(fakeCompilation(issue853Chunks(false)), root)
      ).toEqual([]);
    });

    it("ignores chunks without a runtime and records the request of an origin", () => {
      const a = fakeChunk({ name: "a" });
      const b = fakeChunk({ name: "b" });
      const shared = fakeChunk({ id: 1 }, false);
      const toB: ChunkCycleEntrypointLike = {
        chunks: [shared, b],
        origins: [
          { module: fakeModule(`${root}/lib/a.ts`), request: "./b.ts" },
        ],
      };
      const toA: ChunkCycleEntrypointLike = {
        chunks: [a],
        origins: [{ module: null }],
      };
      a.referenced = [toB];
      b.referenced = [toA];
      shared.referenced = [toA];

      const [cycle] = analyzeRuntimeChunkCycles(
        fakeCompilation([a, b, shared]),
        root
      );
      expect(cycle.chunks).toEqual(["a", "b"]);
      expect(cycle.edges).toEqual([
        { from: "a", to: "b", via: ['lib/a.ts requests "./b.ts"'] },
        { from: "b", to: "a", via: ["(unknown module)"] },
      ]);
    });
  });

  describe("ChunkCycleGuardPlugin", () => {
    class FakeWebpackError extends Error {}

    function runPlugin(compilation: ReturnType<typeof fakeCompilation>) {
      const compiler: ChunkCycleCompilerLike = {
        context: root,
        webpack: { WebpackError: FakeWebpackError },
        hooks: {
          compilation: { tap: (_name, callback) => callback(compilation) },
        },
      };
      new ChunkCycleGuardPlugin().apply(compiler);
      for (const hook of compilation.sealHooks) hook();
      return compilation.errors as Error[];
    }

    it("fails the compilation when a runtime chunk cycle exists", () => {
      const errors = runPlugin(fakeCompilation(issue853Chunks(true)));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FakeWebpackError);
      expect(errors[0].message).toContain("lib/neuro/mesh-worker.ts");
    });

    it("leaves a clean compilation untouched", () => {
      expect(runPlugin(fakeCompilation(issue853Chunks(false)))).toEqual([]);
    });

    it("escalates webpack's own warning if its analysis finds a cycle this one missed", () => {
      const warning = {
        message: `${WEBPACK_RUNTIME_CHUNK_CYCLE_WARNING} (webpack, 9010)\nThis prevents using hashes of each other and should be avoided.`,
      };
      const compilation = fakeCompilation(issue853Chunks(false), [warning]);
      const errors = runPlugin(compilation);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("(webpack, 9010)");
      // Escalated, never suppressed: webpack's warning stays where it was.
      expect(compilation.warnings).toEqual([warning]);
    });

    it("is registered for every compilation in next.config.ts", () => {
      const config = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
      expect(config).toMatch(
        /import \{ ChunkCycleGuardPlugin \} from "\.\/lib\/dx\/chunk-cycle-guard"/
      );
      expect(config).toContain(
        "config.plugins.push(new ChunkCycleGuardPlugin())"
      );
    });
  });

  describe("static worker self-reference check", () => {
    const WORKER_URL =
      /new\s+(?:Shared)?Worker\(\s*new\s+URL\(\s*["'`]([^"'`]+)["'`]\s*,\s*import\.meta\.url/g;
    const IMPORT_SPECIFIER =
      /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
    const EXTENSIONS = ["", ".ts", ".tsx", ".js", "/index.ts", "/index.tsx"];

    function resolveLocal(fromFile: string, specifier: string): string | null {
      let base: string;
      if (specifier.startsWith("@/")) {
        base = path.join(root, specifier.slice(2));
      } else if (specifier.startsWith(".")) {
        base = path.resolve(path.dirname(fromFile), specifier);
      } else {
        return null;
      }
      for (const extension of EXTENSIONS) {
        const candidate = base + extension;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      }
      return null;
    }

    function stripComments(source: string): string {
      return source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    }

    function importClosure(entry: string): Set<string> {
      const seen = new Set<string>();
      const queue = [entry];
      while (queue.length > 0) {
        const file = queue.pop() as string;
        if (seen.has(file)) continue;
        seen.add(file);
        const source = stripComments(fs.readFileSync(file, "utf8"));
        for (const match of source.matchAll(IMPORT_SPECIFIER)) {
          const resolved = resolveLocal(file, match[1] ?? match[2]);
          if (resolved) queue.push(resolved);
        }
      }
      return seen;
    }

    function listSources(dir: string): string[] {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "generated")
          continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listSources(full));
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
      }
      return out;
    }

    const workers = new Map<string, string>();
    for (const dir of ["app", "components", "hooks", "lib"]) {
      for (const file of listSources(path.join(root, dir))) {
        const source = stripComments(fs.readFileSync(file, "utf8"));
        for (const match of source.matchAll(WORKER_URL)) {
          const worker = resolveLocal(file, match[1]);
          if (worker) workers.set(worker, file);
        }
      }
    }

    it("discovers the repository's module workers", () => {
      const relative = [...workers.keys()].map((w) => path.relative(root, w));
      expect(relative).toContain(path.join("lib", "neuro", "mesh-worker.ts"));
    });

    it("never lets a worker's import graph reach the module that constructs it", () => {
      const offenders: string[] = [];
      for (const worker of workers.keys()) {
        for (const file of importClosure(worker)) {
          const source = stripComments(fs.readFileSync(file, "utf8"));
          for (const match of source.matchAll(WORKER_URL)) {
            if (resolveLocal(file, match[1]) === worker) {
              offenders.push(
                `${path.relative(root, worker)} imports ${path.relative(root, file)}, which constructs it`
              );
            }
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  });
});
