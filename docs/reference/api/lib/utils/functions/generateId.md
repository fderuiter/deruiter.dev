[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/utils](../README.md) / generateId

# Function: generateId()

> **generateId**(`prefix?`, `options?`): `string`

Standardized random identifier generator for client-side and server-side
runtime identifiers (log entries, queue items, storage keys, message IDs).

The random part is 9 hex characters drawn from Web Crypto when available.
A prefix is joined with `-`, unless it already ends in `-` or `_`, in which
case that delimiter is kept and reused before the timestamp's random part.

Do not use it for IDs that appear in server-rendered markup, since the value
differs between server and client; use React's `useId` there instead.

## Parameters

### prefix?

`string`

Optional namespace, e.g. `"event"` or `"sim_msg_"`.

### options?

[`GenerateIdOptions`](../interfaces/GenerateIdOptions.md) = `{}`

Optional formatting, see [GenerateIdOptions](../interfaces/GenerateIdOptions.md).

## Returns

`string`

An identifier such as `event-1759140000000-3f9a1c2b7`.
