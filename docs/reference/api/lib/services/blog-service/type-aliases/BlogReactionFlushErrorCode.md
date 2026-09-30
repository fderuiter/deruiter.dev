[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/blog-service](../README.md) / BlogReactionFlushErrorCode

# Type Alias: BlogReactionFlushErrorCode

> **BlogReactionFlushErrorCode** = `z.infer`\<*typeof* [`BlogReactionFlushErrorCode`](../variables/BlogReactionFlushErrorCode.md)\>

Error codes returned by [BlogPostService.flushBufferedReactionsToDatabase](../classes/BlogPostService.md#flushbufferedreactionstodatabase)
(ADR 0028).

`PERSISTENCE_FAILED` means the batch did not reach Postgres and stays in the
processing queue for the next run. `FLUSH_FAILED` covers the Redis queue
reads and acknowledgement around it; persisted events that were not
acknowledged are replayed idempotently through their pinned ids.
