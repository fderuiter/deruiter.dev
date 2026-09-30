[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/codex](../README.md) / CodexEntrySchema

# Variable: CodexEntrySchema

> `const` **CodexEntrySchema**: `ZodObject`\<\{ `firstSeen`: `ZodObject`\<\{ `actId`: `ZodString`; `origin`: `ZodOptional`\<`ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"RANDOM"`\>; \}, `$strip`\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"SEEDED"`\>; \}, `$strip`\>, `ZodObject`\<\{ `date`: `ZodString`; `kind`: `ZodLiteral`\<`"DAILY"`\>; \}, `$strip`\>\], `"kind"`\>\>; `seed`: `ZodString`; \}, `$strip`\>; `via`: `ZodEnum`\<\{ `BOSS`: `"BOSS"`; `CRISIS`: `"CRISIS"`; `PACK`: `"PACK"`; `PLAYED`: `"PLAYED"`; `RACK`: `"RACK"`; `REWARD`: `"REWARD"`; `SHOP`: `"SHOP"`; `SPONSOR`: `"SPONSOR"`; `TRAY`: `"TRAY"`; \}\>; \}, `$strip`\>

One discovered entry.
