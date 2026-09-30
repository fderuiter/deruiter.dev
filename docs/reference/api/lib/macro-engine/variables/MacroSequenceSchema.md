[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/macro-engine](../README.md) / MacroSequenceSchema

# Variable: MacroSequenceSchema

> `const` **MacroSequenceSchema**: `ZodObject`\<\{ `createdAt`: `ZodDefault`\<`ZodNumber`\>; `description`: `ZodOptional`\<`ZodString`\>; `id`: `ZodString`; `name`: `ZodString`; `steps`: `ZodArray`\<`ZodObject`\<\{ `actionId`: `ZodString`; `args`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>; `timestamp`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>\>; `updatedAt`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>
