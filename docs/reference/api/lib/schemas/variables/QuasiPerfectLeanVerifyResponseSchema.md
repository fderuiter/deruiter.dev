[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/schemas](../README.md) / QuasiPerfectLeanVerifyResponseSchema

# Variable: QuasiPerfectLeanVerifyResponseSchema

> `const` **QuasiPerfectLeanVerifyResponseSchema**: `ZodObject`\<\{ `diagnostics`: `ZodArray`\<`ZodObject`\<\{ `column`: `ZodOptional`\<`ZodNumber`\>; `line`: `ZodNumber`; `message`: `ZodString`; `severity`: `ZodEnum`\<\{ `error`: `"error"`; `info`: `"info"`; `warning`: `"warning"`; \}\>; \}, `$strip`\>\>; `engine`: `ZodEnum`\<\{ `fallback_simulator`: `"fallback_simulator"`; `lean4_kernel`: `"lean4_kernel"`; \}\>; `executionTimeMs`: `ZodNumber`; `goalState`: `ZodOptional`\<`ZodString`\>; `status`: `ZodEnum`\<\{ `error`: `"error"`; `fallback_simulated`: `"fallback_simulated"`; `in_progress`: `"in_progress"`; `verified`: `"verified"`; \}\>; `success`: `ZodBoolean`; \}, `$strip`\>
