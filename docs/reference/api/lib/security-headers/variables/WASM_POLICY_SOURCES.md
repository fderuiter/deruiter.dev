[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/security-headers](../README.md) / WASM\_POLICY\_SOURCES

# Variable: WASM\_POLICY\_SOURCES

> `const` **WASM\_POLICY\_SOURCES**: readonly `string`[]

The only paths whose policy allows WebAssembly compilation: the SQL
workbench (#2633) and the DuckDB worker it starts, which compiles the
engine. Browsers have disagreed on whether a dedicated worker takes the
policy of its own script's response or of the page that started it, so
both carry it. Every other route keeps a policy that refuses WebAssembly.
