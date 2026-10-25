[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/redis-timeout](../README.md) / withRedisTimeout

# Function: withRedisTimeout()

> **withRedisTimeout**\<`T`\>(`promise`, `ms`, `message`): `Promise`\<`T`\>

Races a Redis command against a timeout, always clearing the timer so it
cannot hold the event loop open.

## Type Parameters

### T

`T`

## Parameters

### promise

`Promise`\<`T`\>

The pending Redis command.

### ms

`number`

Time budget in milliseconds.

### message

`string`

Message for the `RedisTimeoutError` raised when the budget runs out.

## Returns

`Promise`\<`T`\>

The command's result if it settles first.
