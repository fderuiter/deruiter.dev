[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/newsletter-service](../README.md) / NewsletterDispatchErrorCode

# Variable: NewsletterDispatchErrorCode

> `const` **NewsletterDispatchErrorCode**: `ZodEnum`\<\{ `DISPATCH_FAILED`: `"DISPATCH_FAILED"`; `ENQUEUE_FAILED`: `"ENQUEUE_FAILED"`; \}\>

Error codes returned by [NewsletterService.dispatchDue](../classes/NewsletterService.md#dispatchdue) (ADR 0028).

`ENQUEUE_FAILED` means an announcement could not be written to the outbound
queue; its delivery claim is released so the next run retries that
recipient. `DISPATCH_FAILED` means a database read or write in the phase
failed. Either way the dispatch stays open for the next run.
