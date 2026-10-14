[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/trial-and-error/types](../README.md) / RelicTriggerSchema

# Variable: RelicTriggerSchema

> `const` **RelicTriggerSchema**: `ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `phase`: `ZodLiteral`\<`"ON_HAND_PLAYED"`\>; `requires`: `ZodOptional`\<`ZodEnum`\<\{ `FIGURE_IN_HAND`: `"FIGURE_IN_HAND"`; `NO_REDLINES`: `"NO_REDLINES"`; \}\>\>; `scale`: `ZodOptional`\<`ZodEnum`\<\{ `HANDS_PLAYED`: `"HANDS_PLAYED"`; `REDLINES_FIXED`: `"REDLINES_FIXED"`; `STALE_IN_HAND`: `"STALE_IN_HAND"`; \}\>\>; \}, `$strip`\>, `ZodObject`\<\{ `cardType`: `ZodOptional`\<`ZodEnum`\<\{ `FIGURE`: `"FIGURE"`; `LISTING`: `"LISTING"`; `SUBJECT_TOKEN`: `"SUBJECT_TOKEN"`; `TABLE`: `"TABLE"`; \}\>\>; `phase`: `ZodLiteral`\<`"ON_CARD_SCORED"`\>; `population`: `ZodOptional`\<`ZodEnum`\<\{ `FAS`: `"FAS"`; `ITT`: `"ITT"`; `PER_PROTOCOL`: `"PER_PROTOCOL"`; `SAFETY`: `"SAFETY"`; `SCREENED`: `"SCREENED"`; \}\>\>; `qcPassedOnly`: `ZodOptional`\<`ZodBoolean`\>; `retrigger`: `ZodOptional`\<`ZodBoolean`\>; \}, `$strip`\>, `ZodObject`\<\{ `freeDiscards`: `ZodOptional`\<`ZodNumber`\>; `phase`: `ZodLiteral`\<`"ON_DISCARD"`\>; `stacks`: `ZodOptional`\<`ZodBoolean`\>; \}, `$strip`\>, `ZodObject`\<\{ `cpu`: `ZodNumber`; `cpuPerAct`: `ZodOptional`\<`ZodNumber`\>; `phase`: `ZodLiteral`\<`"ON_BLIND_START"`\>; \}, `$strip`\>\], `"phase"`\>

When and on what an SOP relic fires (#924). A relic never overrides the
SAP: it adds to a hand's score, or eases an action's CPU cost, and every
rule result, redline and zero-score rule still stands.

- ON_HAND_PLAYED: its modifier joins the hand, optionally only when the
  hand holds a Figure or carries no redline. With `scale` (#2083) it joins
  once per thing counted, and not at all at zero.
- ON_CARD_SCORED: its modifier joins once for each scored card that
  matches, or, with `retrigger`, the card's own Chips and +Mult score again.
- ON_DISCARD: the Blind's first `freeDiscards` discards cost no base CPU.
  With `stacks` (#2083), each discard made this Blind adds its modifier
  once more to every hand played after it.
- ON_BLIND_START: each Blind starts with `cpu` more CPU, and `cpuPerAct`
  (#2083) more again for each act the run has reached past the first.
