[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/qstash-retry](../README.md) / scheduleEmailRetry

# Function: scheduleEmailRetry()

> **scheduleEmailRetry**(`queueId`, `attempts`): `Promise`\<`boolean`\>

Publishes a delayed message asking the webhook to retry one queued email.
Best effort: returns false, never throws, so a QStash outage or missing
configuration leaves the durable queue and the daily maintenance retry as
the fallback.

## Parameters

### queueId

`string`

### attempts

`number`

## Returns

`Promise`\<`boolean`\>
