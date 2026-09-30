[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/trial-and-error/types](../README.md) / RunSaveSchema

# Variable: RunSaveSchema

> `const` **RunSaveSchema**: `ZodObject`\<\{ `actId`: `ZodString`; `actions`: `ZodArray`\<`ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `cardId`: `ZodString`; `type`: `ZodLiteral`\<`"TOGGLE_SELECT"`\>; \}, `$strip`\>, `ZodObject`\<\{ `type`: `ZodLiteral`\<`"PLAY_HAND"`\>; \}, `$strip`\>, `ZodObject`\<\{ `type`: `ZodLiteral`\<`"DISCARD"`\>; \}, `$strip`\>, `ZodObject`\<\{ `cardId`: `ZodString`; `type`: `ZodLiteral`\<`"INSPECT_CARD"`\>; \}, `$strip`\>\], `"type"`\>\>; `savedAt`: `ZodString`; `seed`: `ZodString`; `sponsorId`: `ZodOptional`\<`ZodEnum`\<\{ `CARDIO_MEGA_TRIAL`: `"CARDIO_MEGA_TRIAL"`; `ONCOLOGY_PHARMA`: `"ONCOLOGY_PHARMA"`; `RARE_DISEASE_BIOTECH`: `"RARE_DISEASE_BIOTECH"`; `VIRTUAL_BIOTECH`: `"VIRTUAL_BIOTECH"`; \}\>\>; `stake`: `ZodOptional`\<`ZodNumber`\>; `version`: `ZodLiteral`\<`1`\>; \}, `$strip`\>

A saved run (#1079): the act, the seed and every move since the run
started. Loading replays the moves, so resuming never re-draws.
