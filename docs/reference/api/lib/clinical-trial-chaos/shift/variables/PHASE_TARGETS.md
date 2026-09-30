[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / PHASE\_TARGETS

# Variable: PHASE\_TARGETS

> `const` **PHASE\_TARGETS**: `Readonly`\<`Record`\<[`GamePhase`](../../types/type-aliases/GamePhase.md), `number`\>\>

New CRFs to lock in each campaign phase before it is cleared. Each phase
counts its own locks from zero, so every phase asks for more than the last
(#1673); the campaign score and total still carry across phases (#1325).
