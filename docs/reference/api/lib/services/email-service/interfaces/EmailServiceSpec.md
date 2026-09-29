[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/email-service](../README.md) / EmailServiceSpec

# Interface: EmailServiceSpec

Contract specification for transactional outbound email services.
Conforms to ADR 0028 Typed Service Contract (Spec & Handler Pattern).

## Extended by

- [`EmailServiceHandler`](EmailServiceHandler.md)

## Methods

### getRetryQueueHealth()

> **getRetryQueueHealth**(`now?`): `Promise`\<\{ `exhaustedDeadLetterCount`: `number`; `oldestDueAgeSeconds`: `number`; `retryingCount`: `number`; \}\>

#### Parameters

##### now?

`Date`

#### Returns

`Promise`\<\{ `exhaustedDeadLetterCount`: `number`; `oldestDueAgeSeconds`: `number`; `retryingCount`: `number`; \}\>

***

### handleWebhookEvent()

> **handleWebhookEvent**(`event`): `Promise`\<`boolean`\>

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

`Promise`\<`boolean`\>

***

### isSuppressed()

> **isSuppressed**(`email`): `Promise`\<\{ `reason?`: `string`; `suppressed`: `boolean`; \}\>

#### Parameters

##### email

`string`

#### Returns

`Promise`\<\{ `reason?`: `string`; `suppressed`: `boolean`; \}\>

***

### processRetryQueue()

> **processRetryQueue**(`options?`): `Promise`\<\{ `failed`: `number`; `processed`: `number`; `succeeded`: `number`; \}\>

#### Parameters

##### options?

###### maxBatchSize?

`number`

###### now?

`Date`

###### queueId?

`string`

#### Returns

`Promise`\<\{ `failed`: `number`; `processed`: `number`; `succeeded`: `number`; \}\>

***

### recordSuppression()

> **recordSuppression**(`email`, `reason`): `Promise`\<`void`\>

#### Parameters

##### email

`string`

##### reason

[`SuppressionReason`](../../../db/type-aliases/SuppressionReason.md)

#### Returns

`Promise`\<`void`\>

***

### sendContactInquiry()

> **sendContactInquiry**(`submission`): `Promise`\<[`ContactDispatchResult`](ContactDispatchResult.md)\>

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

#### Returns

`Promise`\<[`ContactDispatchResult`](ContactDispatchResult.md)\>

***

### sendFeedbackNotification()

> **sendFeedbackNotification**(`payload`): `Promise`\<[`EmailDispatchResult`](EmailDispatchResult.md)\>

#### Parameters

##### payload

[`FeedbackNotificationPayload`](../../../email-templates/interfaces/FeedbackNotificationPayload.md)

#### Returns

`Promise`\<[`EmailDispatchResult`](EmailDispatchResult.md)\>

***

### sendRawEmail()

> **sendRawEmail**(`options`): `Promise`\<[`EmailDispatchResult`](EmailDispatchResult.md)\>

#### Parameters

##### options

[`RawEmailOptions`](RawEmailOptions.md)

#### Returns

`Promise`\<[`EmailDispatchResult`](EmailDispatchResult.md)\>
