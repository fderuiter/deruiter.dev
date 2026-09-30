[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/trial-and-error/types](../README.md) / RunSaveSchema

# Variable: RunSaveSchema

> `const` **RunSaveSchema**: `ZodObject`\<\{ `actId`: `ZodString`; `actions`: `ZodArray`\<`ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `cardId`: `ZodString`; `type`: `ZodLiteral`\<`"TOGGLE_SELECT"`\>; \}, `$strip`\>, `ZodObject`\<\{ `type`: `ZodLiteral`\<`"PLAY_HAND"`\>; \}, `$strip`\>, `ZodObject`\<\{ `type`: `ZodLiteral`\<`"DISCARD"`\>; \}, `$strip`\>, `ZodObject`\<\{ `cardId`: `ZodString`; `type`: `ZodLiteral`\<`"INSPECT_CARD"`\>; \}, `$strip`\>\], `"type"`\>\>; `origin`: `ZodOptional`\<`ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"RANDOM"`\>; \}, `$strip`\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"SEEDED"`\>; \}, `$strip`\>, `ZodObject`\<\{ `date`: `ZodString`; `kind`: `ZodLiteral`\<`"DAILY"`\>; \}, `$strip`\>\], `"kind"`\>\>; `savedAt`: `ZodString`; `seed`: `ZodString`; `version`: `ZodLiteral`\<`1`\>; \}, `$strip`\>

A saved run (#1079): the act, the seed and every move since the run
started. Loading replays the moves, so resuming never re-draws.
