[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/event-outbox](../README.md) / OutboxFlushResult

# Type Alias: OutboxFlushResult

> **OutboxFlushResult** = [`ServiceResult`](../../service-result/type-aliases/ServiceResult.md)\<\{ `inserted`: `number`; `processed`: `number`; \}, [`OutboxFlushErrorCode`](OutboxFlushErrorCode.md)\>

Typed result envelope returned by [flushOutboxQueue](../functions/flushOutboxQueue.md).
