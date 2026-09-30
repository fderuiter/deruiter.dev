[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/newsletter-service](../README.md) / NewsletterService

# Class: NewsletterService

Deep module for the Systems Dispatch subscriber lifecycle: double opt-in
signup, confirmation, one-click unsubscribe, and the capped announcement
phase that the daily maintenance run drives (#841).

## Constructors

### Constructor

> **new NewsletterService**(): `NewsletterService`

#### Returns

`NewsletterService`

## Methods

### confirm()

> `static` **confirm**(`token`, `now?`): `Promise`\<[`NewsletterTokenOutcome`](../type-aliases/NewsletterTokenOutcome.md)\>

Confirms a PENDING subscriber from its single-use token, then sends the
welcome email and the admin alert.

#### Parameters

##### token

`string`

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`NewsletterTokenOutcome`](../type-aliases/NewsletterTokenOutcome.md)\>

***

### dispatchDue()

> `static` **dispatchDue**(`now?`): `Promise`\<[`NewsletterDispatchResult`](../type-aliases/NewsletterDispatchResult.md)\>

Maintenance phase: enqueues announcement emails for open dispatches into
the outbound queue, oldest dispatch first. Only subscribers who were
CONFIRMED when the post was queued receive it, the suppression list is
rechecked for every recipient, and no run enqueues more than
`NEWSLETTER_DISPATCH_CAP` or the queue's remaining room in one batch.

Never throws: failures are returned as a typed
[NewsletterDispatchErrorCode](../variables/NewsletterDispatchErrorCode.md).

#### Parameters

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`NewsletterDispatchResult`](../type-aliases/NewsletterDispatchResult.md)\>

***

### queuePostAnnouncement()

> `static` **queuePostAnnouncement**(`blogPostId`): `Promise`\<`void`\>

Records that a newly published post should be announced. Idempotent:
republishing a post never announces it twice. Nothing is sent here; the
daily maintenance run drains dispatches under the cap.

#### Parameters

##### blogPostId

`string`

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> `static` **subscribe**(`rawEmail`, `now?`): `Promise`\<[`NewsletterSubscribeResult`](../interfaces/NewsletterSubscribeResult.md)\>

Records a signup as PENDING and sends a confirmation link. Confirmed
addresses are left alone and nothing is revealed about whether an address
was already subscribed.

#### Parameters

##### rawEmail

`string`

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`NewsletterSubscribeResult`](../interfaces/NewsletterSubscribeResult.md)\>

***

### unsubscribe()

> `static` **unsubscribe**(`token`, `now?`): `Promise`\<[`NewsletterTokenOutcome`](../type-aliases/NewsletterTokenOutcome.md)\>

Unsubscribes from the long-lived token in every dispatch. Works without
signing in and needs no second step.

#### Parameters

##### token

`string`

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`NewsletterTokenOutcome`](../type-aliases/NewsletterTokenOutcome.md)\>
