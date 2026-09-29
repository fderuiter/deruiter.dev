[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/schemas](../README.md) / QStashRetryResponseSchema

# Variable: QStashRetryResponseSchema

> `const` **QStashRetryResponseSchema**: `ZodObject`\<\{ `failed`: `ZodOptional`\<`ZodNumber`\>; `ignored`: `ZodOptional`\<`ZodString`\>; `processed`: `ZodOptional`\<`ZodNumber`\>; `queueId`: `ZodOptional`\<`ZodString`\>; `received`: `ZodBoolean`; `rescheduled`: `ZodOptional`\<`ZodBoolean`\>; `succeeded`: `ZodOptional`\<`ZodNumber`\>; \}, `$strip`\>

Response of the QStash email-retry webhook.
