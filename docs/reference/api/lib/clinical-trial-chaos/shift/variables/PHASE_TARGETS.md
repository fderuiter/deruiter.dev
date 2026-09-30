[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / PHASE\_TARGETS

# Variable: PHASE\_TARGETS

> `const` **PHASE\_TARGETS**: `Readonly`\<`Record`\<[`GamePhase`](../../types/type-aliases/GamePhase.md), `number`\>\>

Campaign-total CRF locks at which each phase clears: 5, then 8, then 12, so
the phases ask for 5, 3 and 4 new locks. The header shows each phase's new
locks against its own new target (#1673); the campaign score and total
carry across phases (#1325).
