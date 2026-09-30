[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/codex](../README.md) / RunHistoryEntrySchema

# Variable: RunHistoryEntrySchema

> `const` **RunHistoryEntrySchema**: `ZodObject`\<\{ `actId`: `ZodString`; `bestHand`: `ZodNullable`\<`ZodObject`\<\{ `handType`: `ZodEnum`\<\{ `CSR_STRAIGHT`: `"CSR_STRAIGHT"`; `EFFICACY_FULL_HOUSE`: `"EFFICACY_FULL_HOUSE"`; `HIGH_TABLE`: `"HIGH_TABLE"`; `MEDDRA_FIVE_OF_A_KIND`: `"MEDDRA_FIVE_OF_A_KIND"`; `POPULATION_FLUSH`: `"POPULATION_FLUSH"`; `TLF_PAIR`: `"TLF_PAIR"`; `TLF_TWO_PAIR`: `"TLF_TWO_PAIR"`; \}\>; `score`: `ZodNumber`; \}, `$strip`\>\>; `campaignWon`: `ZodBoolean`; `endedOn`: `ZodOptional`\<`ZodString`\>; `moves`: `ZodNumber`; `origin`: `ZodOptional`\<`ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"RANDOM"`\>; \}, `$strip`\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"SEEDED"`\>; \}, `$strip`\>, `ZodObject`\<\{ `date`: `ZodString`; `kind`: `ZodLiteral`\<`"DAILY"`\>; \}, `$strip`\>\], `"kind"`\>\>; `reached`: `ZodObject`\<\{ `actIndex`: `ZodNumber`; `actTitle`: `ZodString`; `blindIndex`: `ZodNumber`; `blindTitle`: `ZodString`; `round`: `ZodNullable`\<`ZodNumber`\>; \}, `$strip`\>; `result`: `ZodEnum`\<\{ `FAILED`: `"FAILED"`; `WON`: `"WON"`; \}\>; `seed`: `ZodString`; `sponsorId`: `ZodOptional`\<`ZodEnum`\<\{ `CARDIO_MEGA_TRIAL`: `"CARDIO_MEGA_TRIAL"`; `ONCOLOGY_PHARMA`: `"ONCOLOGY_PHARMA"`; `RARE_DISEASE_BIOTECH`: `"RARE_DISEASE_BIOTECH"`; `VIRTUAL_BIOTECH`: `"VIRTUAL_BIOTECH"`; \}\>\>; `stake`: `ZodOptional`\<`ZodNumber`\>; \}, `$strip`\>

A finished run, as the history keeps it.
