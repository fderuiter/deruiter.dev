[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/source-state](../README.md) / GENERATED\_BUILD\_ARTIFACTS

# Variable: GENERATED\_BUILD\_ARTIFACTS

> `const` **GENERATED\_BUILD\_ARTIFACTS**: readonly `string`[]

Committed build products that `npm run build` rewrites in place. They are
derived from tracked source, so a rewrite is not a source change and must
not make the working tree count as dirty for benchmark evidence (#1377).
