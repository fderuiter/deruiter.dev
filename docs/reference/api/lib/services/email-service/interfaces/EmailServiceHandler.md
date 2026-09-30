[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/email-service](../README.md) / EmailServiceHandler

# Interface: EmailServiceHandler

Execution handler interface implementing the EmailServiceSpec contract.

## Extends

- [`EmailServiceSpec`](EmailServiceSpec.md)

## Methods

### getRetryQueueHealth()

> **getRetryQueueHealth**(`now?`): `Promise`\<\{ `exhaustedDeadLetterCount`: `number`; `oldestDueAgeSeconds`: `number`; `retryingCount`: `number`; \}\>

#### Parameters

##### now?

`Date`

#### Returns

`Promise`\<\{ `exhaustedDeadLetterCount`: `number`; `oldestDueAgeSeconds`: `number`; `retryingCount`: `number`; \}\>

#### Inherited from

[`EmailServiceSpec`](EmailServiceSpec.md).[`getRetryQueueHealth`](EmailServiceSpec.md#getretryqueuehealth)

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

#### Inherited from

[`EmailServiceSpec`](EmailServiceSpec.md).[`handleWebhookEvent`](EmailServiceSpec.md#handlewebhookevent)

***

### isSuppressed()

> **isSuppressed**(`email`): `Promise`\<\{ `reason?`: `string`; `suppressed`: `boolean`; \}\>

#### Parameters

##### email

`string`

#### Returns

`Promise`\<\{ `reason?`: `string`; `suppressed`: `boolean`; \}\>

#### Inherited from

[`EmailServiceSpec`](EmailServiceSpec.md).[`isSuppressed`](EmailServiceSpec.md#issuppressed)

***

### processRetryQueue()

> **processRetryQueue**(`options?`): `Promise`\<[`EmailRetryResult`](../type-aliases/EmailRetryResult.md)\>

#### Parameters

##### options?

###### maxBatchSize?

`number`

###### now?

`Date`

###### queueId?

`string`

#### Returns

`Promise`\<[`EmailRetryResult`](../type-aliases/EmailRetryResult.md)\>

#### Inherited from

[`EmailServiceSpec`](EmailServiceSpec.md).[`processRetryQueue`](EmailServiceSpec.md#processretryqueue)

***

### queueOutboundEmail()

> **queueOutboundEmail**(`options`, `fromAddress?`, `errorReason?`): `Promise`\<`string` \| `null`\>

#### Parameters

##### options

[`RawEmailOptions`](RawEmailOptions.md)

##### fromAddress?

`string`

##### errorReason?

`string`

#### Returns

`Promise`\<`string` \| `null`\>

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

#### Inherited from

[`EmailServiceSpec`](EmailServiceSpec.md).[`recordSuppression`](EmailServiceSpec.md#recordsuppression)

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

#### Inherited from

[`EmailServiceSpec`](EmailServiceSpec.md).[`sendContactInquiry`](EmailServiceSpec.md#sendcontactinquiry)

***

### sendFeedbackNotification()

> **sendFeedbackNotification**(`payload`): `Promise`\<[`EmailDispatchResult`](EmailDispatchResult.md)\>

#### Parameters

##### payload

[`FeedbackNotificationPayload`](../../../email-templates/interfaces/FeedbackNotificationPayload.md)

#### Returns

`Promise`\<[`EmailDispatchResult`](EmailDispatchResult.md)\>

#### Inherited from

[`EmailServiceSpec`](EmailServiceSpec.md).[`sendFeedbackNotification`](EmailServiceSpec.md#sendfeedbacknotification)

***

### sendRawEmail()

> **sendRawEmail**(`options`): `Promise`\<[`EmailDispatchResult`](EmailDispatchResult.md)\>

#### Parameters

##### options

[`RawEmailOptions`](RawEmailOptions.md)

#### Returns

`Promise`\<[`EmailDispatchResult`](EmailDispatchResult.md)\>

#### Inherited from

[`EmailServiceSpec`](EmailServiceSpec.md).[`sendRawEmail`](EmailServiceSpec.md#sendrawemail)
