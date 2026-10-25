[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/schemas](../README.md) / VersionResponseSchema

# Variable: VersionResponseSchema

> `const` **VersionResponseSchema**: `ZodObject`\<\{ `builtAt`: `ZodNullable`\<`ZodString`\>; `env`: `ZodNullable`\<`ZodEnum`\<\{ `development`: `"development"`; `preview`: `"preview"`; `production`: `"production"`; \}\>\>; `ref`: `ZodNullable`\<`ZodString`\>; `sha`: `ZodString`; \}, `$strip`\>

Response of `GET /api/version`: which commit the serving deployment was
built from (#2534). Every field is public build metadata.
