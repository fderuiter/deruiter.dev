[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/trial-and-error/types](../README.md) / RelicSchema

# Variable: RelicSchema

> `const` **RelicSchema**: `ZodObject`\<\{ `description`: `ZodString`; `id`: `ZodString`; `modifier`: `ZodObject`\<\{ `chips`: `ZodNumber`; `label`: `ZodString`; `plusMult`: `ZodNumber`; `sourceId`: `ZodString`; `xMult`: `ZodNumber`; \}, `$strip`\>; `name`: `ZodString`; `trigger`: `ZodOptional`\<`ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `phase`: `ZodLiteral`\<`"ON_HAND_PLAYED"`\>; `requires`: `ZodOptional`\<`ZodEnum`\<\{ `FIGURE_IN_HAND`: `"FIGURE_IN_HAND"`; `NO_REDLINES`: `"NO_REDLINES"`; \}\>\>; \}, `$strip`\>, `ZodObject`\<\{ `cardType`: `ZodOptional`\<`ZodEnum`\<\{ `FIGURE`: `"FIGURE"`; `LISTING`: `"LISTING"`; `SUBJECT_TOKEN`: `"SUBJECT_TOKEN"`; `TABLE`: `"TABLE"`; \}\>\>; `phase`: `ZodLiteral`\<`"ON_CARD_SCORED"`\>; `population`: `ZodOptional`\<`ZodEnum`\<\{ `FAS`: `"FAS"`; `ITT`: `"ITT"`; `PER_PROTOCOL`: `"PER_PROTOCOL"`; `SAFETY`: `"SAFETY"`; `SCREENED`: `"SCREENED"`; \}\>\>; `qcPassedOnly`: `ZodOptional`\<`ZodBoolean`\>; `retrigger`: `ZodOptional`\<`ZodBoolean`\>; \}, `$strip`\>, `ZodObject`\<\{ `freeDiscards`: `ZodNumber`; `phase`: `ZodLiteral`\<`"ON_DISCARD"`\>; \}, `$strip`\>, `ZodObject`\<\{ `cpu`: `ZodNumber`; `phase`: `ZodLiteral`\<`"ON_BLIND_START"`\>; \}, `$strip`\>\], `"phase"`\>\>; \}, `$strip`\>

An SOP relic: a person or tool on the team that the run keeps once
earned. Without a trigger its modifier joins every later hand's scoring.
