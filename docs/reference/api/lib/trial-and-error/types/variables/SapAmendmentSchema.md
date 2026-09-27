[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/trial-and-error/types](../README.md) / SapAmendmentSchema

# Variable: SapAmendmentSchema

> `const` **SapAmendmentSchema**: `ZodObject`\<\{ `bonusDelta`: `ZodNumber`; `category`: `ZodEnum`\<\{ `PRECISION`: `"PRECISION"`; `ROUNDING`: `"ROUNDING"`; `VALUE`: `"VALUE"`; \}\>; `code`: `ZodString`; `description`: `ZodString`; `id`: `ZodString`; `name`: `ZodString`; `penaltyDelta`: `ZodNumber`; `sellValue`: `ZodNumber`; \}, `$strip`\>

A SAP Amendment (#1086): a consumable the player chooses to use. It amends
one non-fatal rule category of the rulebook in force for the rest of the
run: correcting a discrepancy against it pays `bonusDelta` more +Mult, and
a standing redline costs `penaltyDelta` more. The amended rulebook takes
`code` as a suffix to its id, and every output in hand compiled under the
old rulebook goes stale.
