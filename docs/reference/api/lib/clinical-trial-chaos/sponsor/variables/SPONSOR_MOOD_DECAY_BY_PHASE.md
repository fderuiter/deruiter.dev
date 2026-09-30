[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/sponsor](../README.md) / SPONSOR\_MOOD\_DECAY\_BY\_PHASE

# Variable: SPONSOR\_MOOD\_DECAY\_BY\_PHASE

> `const` **SPONSOR\_MOOD\_DECAY\_BY\_PHASE**: `Readonly`\<`Record`\<`1` \| `2` \| `3`, `number`\>\>

Mood lost per second in each campaign phase. Later phases lock CRFs faster,
so the sponsor's expectations climb with them and satisfaction keeps
mattering instead of pinning at 100% (#1327).
