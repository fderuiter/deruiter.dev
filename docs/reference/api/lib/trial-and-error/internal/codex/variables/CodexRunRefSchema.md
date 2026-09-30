[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/codex](../README.md) / CodexRunRefSchema

# Variable: CodexRunRefSchema

> `const` **CodexRunRefSchema**: `ZodObject`\<\{ `actId`: `ZodString`; `origin`: `ZodOptional`\<`ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"RANDOM"`\>; \}, `$strip`\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"SEEDED"`\>; \}, `$strip`\>, `ZodObject`\<\{ `date`: `ZodString`; `kind`: `ZodLiteral`\<`"DAILY"`\>; \}, `$strip`\>\], `"kind"`\>\>; `seed`: `ZodString`; \}, `$strip`\>

The run an entry was first seen in.
