[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/levels](../README.md) / LEVEL\_REFERENCE\_PROOFS

# Variable: LEVEL\_REFERENCE\_PROOFS

> `const` **LEVEL\_REFERENCE\_PROOFS**: `Readonly`\<`Record`\<`number`, readonly [`TacticId`](../../types/type-aliases/TacticId.md)[]\>\>

The cheapest proof each level's hints describe, one tactic per step, keyed
by level id. A tactic id that appears twice takes the level's cards for it
in order (rw [h1] before rw [h2]).

These paths are the single source for two promises. The gold RAM target
must be reachable (#1939), and the step par shown on the board is each
path's length (#2059). `__tests__/quasi-puzzler-gold-reachable.test.ts`
plays every path through the tactic engine, so a par the board shows is a
proof that exists.
