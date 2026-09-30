[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/email-service](../README.md) / EmailService

# Class: EmailService

Deep module encapsulating all outbound transactional email workflows,
bounce/complaint suppression list defenses, retry queueing, and webhook ingestion.

## Constructors

### Constructor

> **new EmailService**(): `EmailService`

#### Returns

`EmailService`

## Methods

### enqueueEmail()

> `static` **enqueueEmail**(`options`): `Promise`\<`string` \| `null`\>

Adds an email to the OutboundEmailQueue for the next maintenance run to
send, without a first attempt. Used for bulk mail such as newsletter
dispatches, which must go through the queue's leasing, retry and
idempotency handling. Returns the queue id, or null if nothing was stored.

#### Parameters

##### options

[`RawEmailOptions`](../interfaces/RawEmailOptions.md)

#### Returns

`Promise`\<`string` \| `null`\>

***

### getQueueEntryState()

> `static` **getQueueEntryState**(`queueId`): `Promise`\<\{ `attempts`: `number`; `status`: [`OutboundEmailStatus`](../../../db/type-aliases/OutboundEmailStatus.md); \} \| `null`\>

Returns the retry state of one queue row, or null when it does not exist
(or the read fails). Used by the QStash webhook to decide whether to
schedule another sub-daily attempt.

#### Parameters

##### queueId

`string`

#### Returns

`Promise`\<\{ `attempts`: `number`; `status`: [`OutboundEmailStatus`](../../../db/type-aliases/OutboundEmailStatus.md); \} \| `null`\>

***

### getRetryQueueHealth()

> `static` **getRetryQueueHealth**(`now?`): `Promise`\<\{ `depth`: `number`; `oldestPendingAgeMs`: `number` \| `null`; `retryExhausted`: `number`; `terminalFailures`: `number`; \}\>

Returns secret-free operational health for the durable retry queue.

#### Parameters

##### now?

`Date` = `...`

#### Returns

`Promise`\<\{ `depth`: `number`; `oldestPendingAgeMs`: `number` \| `null`; `retryExhausted`: `number`; `terminalFailures`: `number`; \}\>

***

### handleWebhookEvent()

> `static` **handleWebhookEvent**(`event`): `Promise`\<\{ `handled`: `boolean`; `reason?`: `string`; `suppressed?`: `boolean`; \}\>

Processes incoming Resend deliverability webhook event.

`handled: false` signals a durable-processing failure (e.g. the
suppression-list write threw) rather than a no-op event type; callers
must treat that as retryable and must not acknowledge the delivery.

#### Parameters

##### event

###### created_at?

`string` = `...`

###### data

\{\[`key`: `string`\]: `unknown`; `bounce?`: \{ `message?`: `string`; `type?`: `string`; \}; `created_at?`: `string`; `from?`: `string`; `id?`: `string`; `status?`: `string`; `subject?`: `string`; `to?`: `string`[]; \} = `...`

###### data.bounce?

\{ `message?`: `string`; `type?`: `string`; \} = `...`

###### data.bounce.message?

`string` = `...`

###### data.bounce.type?

`string` = `...`

###### data.created_at?

`string` = `...`

###### data.from?

`string` = `...`

###### data.id?

`string` = `...`

###### data.status?

`string` = `...`

###### data.subject?

`string` = `...`

###### data.to?

`string`[] = `...`

###### type

`"email.sent"` \| `"email.delivered"` \| `"email.delivery_delayed"` \| `"email.complained"` \| `"email.bounced"` \| `"email.opened"` \| `"email.clicked"` = `...`

#### Returns

`Promise`\<\{ `handled`: `boolean`; `reason?`: `string`; `suppressed?`: `boolean`; \}\>

***

### isSuppressed()

> `static` **isSuppressed**(`email`): `Promise`\<\{ `reason?`: `string`; `suppressed`: `boolean`; \}\>

Checks if an email address is in the suppression list (bounced, complained, unsubscribed).

#### Parameters

##### email

`string`

#### Returns

`Promise`\<\{ `reason?`: `string`; `suppressed`: `boolean`; \}\>

***

### processRetryQueue()

> `static` **processRetryQueue**(`options?`): `Promise`\<[`EmailRetryResult`](../type-aliases/EmailRetryResult.md)\>

Processes due items from OutboundEmailQueue with exponential backoff.

Never throws: a lease or queue-update failure is returned as a typed
[EmailRetryErrorCode](../variables/EmailRetryErrorCode.md).

#### Parameters

##### options?

###### maxBatchSize?

`number`

###### now?

`Date`

###### queueId?

`string`

Restrict the run to one queue row (QStash-targeted retry).

#### Returns

`Promise`\<[`EmailRetryResult`](../type-aliases/EmailRetryResult.md)\>

***

### queueOutboundEmail()

> `static` **queueOutboundEmail**(`options`, `fromAddress?`, `errorReason?`): `Promise`\<`string` \| `null`\>

Enqueues an email to the persistent OutboundEmailQueue table.

Returns the durable queue id, or `null` when the row could not be
persisted. A null result means the message is not queued and will not be
retried; callers must not present it as accepted for delivery.

#### Parameters

##### options

[`RawEmailOptions`](../interfaces/RawEmailOptions.md)

##### fromAddress?

`string`

##### errorReason?

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### recordSuppression()

> `static` **recordSuppression**(`email`, `reason`): `Promise`\<`void`\>

Records an email address in the suppression list.

Deliberately lets a database failure propagate instead of swallowing it:
the caller (`handleWebhookEvent`) depends on this rejecting so it can
report the event as unhandled, which in turn makes the webhook route
respond with a retryable non-2xx status instead of acknowledging a
durable write that never happened. The upsert is idempotent by
construction, so a retried delivery (or a partially-failed batch of
recipients being reprocessed from the start) is always safe to replay.

#### Parameters

##### email

`string`

##### reason

[`SuppressionReason`](../../../db/type-aliases/SuppressionReason.md)

#### Returns

`Promise`\<`void`\>

***

### resetClient()

> `static` **resetClient**(): `void`

Resets the cached Resend client instance (primarily used for test isolation).

#### Returns

`void`

***

### sendContactInquiry()

> `static` **sendContactInquiry**(`submission`, `connectionHash?`): `Promise`\<[`ContactDispatchResult`](../interfaces/ContactDispatchResult.md)\>

Dispatches an inbound visitor inquiry:
1. Delivers admin notification to CONTACT_NOTIFICATION_EMAIL
2. Delivers automated confirmation receipt to the visitor

#### Parameters

##### submission

###### _clientTimestamp?

`number` = `...`

###### _gotcha?

`string` = `...`

###### email

`string` = `...`

###### intent

`"general"` \| `"other"` \| `"collaboration"` \| `"consulting"` \| `"recruiting"` = `...`

###### message

`string` = `...`

###### name

`string` = `...`

###### subject

`string` = `...`

##### connectionHash?

`string`

#### Returns

`Promise`\<[`ContactDispatchResult`](../interfaces/ContactDispatchResult.md)\>

***

### sendFeedbackNotification()

> `static` **sendFeedbackNotification**(`payload`): `Promise`\<[`EmailDispatchResult`](../interfaces/EmailDispatchResult.md)\>

Dispatches an alert email to the admin when visitor feedback is submitted on a case study.

#### Parameters

##### payload

[`FeedbackNotificationPayload`](../../../email-templates/interfaces/FeedbackNotificationPayload.md)

#### Returns

`Promise`\<[`EmailDispatchResult`](../interfaces/EmailDispatchResult.md)\>

***

### sendRawEmail()

> `static` **sendRawEmail**(`options`): `Promise`\<[`EmailDispatchResult`](../interfaces/EmailDispatchResult.md)\>

Core dispatcher that transmits an email via Resend SDK or executes simulated delivery.

#### Parameters

##### options

[`RawEmailOptions`](../interfaces/RawEmailOptions.md)

#### Returns

`Promise`\<[`EmailDispatchResult`](../interfaces/EmailDispatchResult.md)\>
