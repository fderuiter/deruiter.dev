[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/three-view-guard](../README.md) / THREE\_VIEW\_ALLOWLIST

# Variable: THREE\_VIEW\_ALLOWLIST

> `const` **THREE\_VIEW\_ALLOWLIST**: `Readonly`\<`Record`\<`string`, `number`\>\>

Files that still break a device-read or view rule, each with the epic
that moves it onto its views. Remove a row when that work lands; a row
whose file is gone or clean is reported, so the list cannot go stale.
