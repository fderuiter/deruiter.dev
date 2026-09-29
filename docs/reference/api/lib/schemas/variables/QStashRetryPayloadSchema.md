[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/schemas](../README.md) / QStashRetryPayloadSchema

# Variable: QStashRetryPayloadSchema

> `const` **QStashRetryPayloadSchema**: `ZodObject`\<\{ `queueId`: `ZodString`; \}, `$strip`\>

Body of the delayed QStash message that asks the app to retry one queued
outbound email (#715). Carries only the queue id; the message content stays
in the database.
