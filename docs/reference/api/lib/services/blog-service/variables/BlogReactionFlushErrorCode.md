[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/blog-service](../README.md) / BlogReactionFlushErrorCode

# Variable: BlogReactionFlushErrorCode

> `const` **BlogReactionFlushErrorCode**: `ZodEnum`\<\{ `FLUSH_FAILED`: `"FLUSH_FAILED"`; `PERSISTENCE_FAILED`: `"PERSISTENCE_FAILED"`; \}\>

Error codes returned by [BlogPostService.flushBufferedReactionsToDatabase](../classes/BlogPostService.md#flushbufferedreactionstodatabase)
(ADR 0028).

`PERSISTENCE_FAILED` means the batch did not reach Postgres and stays in the
processing queue for the next run. `FLUSH_FAILED` covers the Redis queue
reads and acknowledgement around it; persisted events that were not
acknowledged are replayed idempotently through their pinned ids.
