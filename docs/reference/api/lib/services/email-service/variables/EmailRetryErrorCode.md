[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/email-service](../README.md) / EmailRetryErrorCode

# Variable: EmailRetryErrorCode

> `const` **EmailRetryErrorCode**: `ZodEnum`\<\{ `QUEUE_LEASE_FAILED`: `"QUEUE_LEASE_FAILED"`; `QUEUE_UPDATE_FAILED`: `"QUEUE_UPDATE_FAILED"`; \}\>

Error codes returned by [EmailService.processRetryQueue](../classes/EmailService.md#processretryqueue) (ADR 0028).

`QUEUE_LEASE_FAILED` means no rows were leased, so nothing was attempted.
`QUEUE_UPDATE_FAILED` means a queue row could not be updated mid-run; rows
not yet updated keep their lease and become due again when it expires.
