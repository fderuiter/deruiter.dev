[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/variants](../README.md) / LEVEL\_VARIANT\_RULES

# Variable: LEVEL\_VARIANT\_RULES

> `const` **LEVEL\_VARIANT\_RULES**: `Readonly`\<`Record`\<`number`, `LevelVariantRules`\>\>

Authored variant rules, keyed by level id. Deterministic data: no
randomness, and `__tests__/quasi-puzzler-gold-reachable.test.ts` plays every
variant's reference proof through the tactic engine under its constraint.
