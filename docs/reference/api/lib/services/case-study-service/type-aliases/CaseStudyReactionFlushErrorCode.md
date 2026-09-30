[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/case-study-service](../README.md) / CaseStudyReactionFlushErrorCode

# Type Alias: CaseStudyReactionFlushErrorCode

> **CaseStudyReactionFlushErrorCode** = `z.infer`\<*typeof* [`CaseStudyReactionFlushErrorCode`](../variables/CaseStudyReactionFlushErrorCode.md)\>

Error codes returned by [CaseStudyService.flushBufferedReactionsToDatabase](../classes/CaseStudyService.md#flushbufferedreactionstodatabase)
(ADR 0028 typed service contract).

`PERSISTENCE_FAILED` means the batch did not reach Postgres and stays in the
processing queue for the next run. `FLUSH_FAILED` covers the Redis queue
reads and acknowledgement around it; persisted events that were not
acknowledged are replayed idempotently through their pinned ids.
