[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/bundle-guard](../README.md) / LAZY\_VENDOR\_CHUNK\_BUDGETS

# Variable: LAZY\_VENDOR\_CHUNK\_BUDGETS

> `const` **LAZY\_VENDOR\_CHUNK\_BUDGETS**: `ReadonlyArray`\<\{ `marker`: `string`; `maxGzip`: `number`; `name`: `string`; \}\>

Third-party chunks that are only ever loaded on demand and cannot be split
further, each with its own ceiling in place of `maxSingleChunkGzip`.
A chunk matches when it is not part of the initial bundle and its source
contains `marker`. Mermaid 12 lazy-loads the ELK layout engine (about
430 kB gzip) only for `elk` layout diagrams (#1490).
