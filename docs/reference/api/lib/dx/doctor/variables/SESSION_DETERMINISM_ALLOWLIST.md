[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/doctor](../README.md) / SESSION\_DETERMINISM\_ALLOWLIST

# Variable: SESSION\_DETERMINISM\_ALLOWLIST

> `const` **SESSION\_DETERMINISM\_ALLOWLIST**: `Readonly`\<`Record`\<`string`, `string`\>\>

Existing callers, allowed until their game's seam issue threads a seeded
`rng` through them (#2544). Remove an entry when its game migrates; the
check warns about an entry that no longer has a call, so the list only
shrinks.
