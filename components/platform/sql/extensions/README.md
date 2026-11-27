# Vendored DuckDB WebAssembly extensions

Signed DuckDB extension binaries served from the same origin by [`sql-engine.ts`](../sql-engine.ts) when a visitor opens a local Parquet or JSON file in `/platform/sql` ([ADR 0066](../../../../adr/0066-clinical-data-platform-architecture.md)). Each binary only loads into the exact DuckDB engine version and platform it was compiled for.

- npm package: `@duckdb/duckdb-wasm` `1.32.0`
- DuckDB version: `v1.4.3`
- Platform: `wasm_eh`
- License: MIT (`Copyright 2018-2025 Stichting DuckDB Foundation`, see [`LICENSE`](./LICENSE))

## Pinned files

| File                            | DuckDB version | Platform  | Source URL                                                                   | SHA-256                                                            |
| ------------------------------- | -------------- | --------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `json.duckdb_extension.wasm`    | `v1.4.3`       | `wasm_eh` | `https://extensions.duckdb.org/v1.4.3/wasm_eh/json.duckdb_extension.wasm`    | `b997276c8e15cc3ebdeda340d73d15dc1c4f4755ad281280451cb0a2f79302e9` |
| `parquet.duckdb_extension.wasm` | `v1.4.3`       | `wasm_eh` | `https://extensions.duckdb.org/v1.4.3/wasm_eh/parquet.duckdb_extension.wasm` | `22765c8f7dc741cda2b571a66ac7bb355295d7d69a6c37e5315b265672984f55` |

## Refresh after upgrading `@duckdb/duckdb-wasm`

Run one command from the repository root to query the installed `@duckdb/duckdb-wasm` engine version, download both `wasm_eh` binaries (`extensions.duckdb.org` serves Brotli-encoded bodies, so `--compressed` is required), and print the version, URLs and SHA-256 digests to record in the table above:

```bash
DUCKDB_VERSION=$(node -e 'const path=require("node:path"),{createDuckDB,VoidLogger,NODE_RUNTIME}=require("@duckdb/duckdb-wasm/blocking");(async()=>{const dist=path.dirname(require.resolve("@duckdb/duckdb-wasm/blocking")),db=await createDuckDB({mvp:{mainModule:path.join(dist,"duckdb-mvp.wasm"),mainWorker:""},eh:{mainModule:path.join(dist,"duckdb-eh.wasm"),mainWorker:""}},new VoidLogger(),NODE_RUNTIME);await db.instantiate(()=>{});process.stdout.write(db.getVersion());db.reset()})()') && for ext in json parquet; do url="https://extensions.duckdb.org/${DUCKDB_VERSION}/wasm_eh/${ext}.duckdb_extension.wasm"; curl -fsSL --compressed "$url" -o "components/platform/sql/extensions/${ext}.duckdb_extension.wasm" && printf "%s  %s\n" "$(shasum -a 256 "components/platform/sql/extensions/${ext}.duckdb_extension.wasm" | cut -d" " -f1)" "$url"; done
```

`__tests__/platform-sql-extensions.test.ts` hashes both files and checks the recorded DuckDB and `@duckdb/duckdb-wasm` versions in CI.
