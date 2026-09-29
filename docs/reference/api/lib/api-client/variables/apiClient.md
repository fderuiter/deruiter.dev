[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/api-client](../README.md) / apiClient

# Variable: apiClient

> `const` **apiClient**: `object`

JSON helpers for same-origin API routes. Request bodies are serialised with
`JSON.stringify` and sent with `Content-Type: application/json` unless the
caller's `init.headers` already sets one. `init.method` and `init.body` are
ignored in favour of the helper's own.

## Type Declaration

### delete

> **delete**: \<`T`\>(`url`, `init?`) => `Promise`\<[`ApiClientResponse`](../interfaces/ApiClientResponse.md)\<`T`\>\>

Sends a DELETE request.

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### init?

`RequestInit`

#### Returns

`Promise`\<[`ApiClientResponse`](../interfaces/ApiClientResponse.md)\<`T`\>\>

### get

> **get**: \<`T`\>(`url`, `init?`) => `Promise`\<[`ApiClientResponse`](../interfaces/ApiClientResponse.md)\<`T`\>\>

Sends a GET request.

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### init?

`RequestInit`

#### Returns

`Promise`\<[`ApiClientResponse`](../interfaces/ApiClientResponse.md)\<`T`\>\>

### patch

> **patch**: \<`T`\>(`url`, `body?`, `init?`) => `Promise`\<[`ApiClientResponse`](../interfaces/ApiClientResponse.md)\<`T`\>\>

Sends a PATCH request with an optional JSON body.

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### body?

`unknown`

##### init?

`RequestInit`

#### Returns

`Promise`\<[`ApiClientResponse`](../interfaces/ApiClientResponse.md)\<`T`\>\>

### post

> **post**: \<`T`\>(`url`, `body?`, `init?`) => `Promise`\<[`ApiClientResponse`](../interfaces/ApiClientResponse.md)\<`T`\>\>

Sends a POST request with an optional JSON body.

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### body?

`unknown`

##### init?

`RequestInit`

#### Returns

`Promise`\<[`ApiClientResponse`](../interfaces/ApiClientResponse.md)\<`T`\>\>

### put

> **put**: \<`T`\>(`url`, `body?`, `init?`) => `Promise`\<[`ApiClientResponse`](../interfaces/ApiClientResponse.md)\<`T`\>\>

Sends a PUT request with an optional JSON body.

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### body?

`unknown`

##### init?

`RequestInit`

#### Returns

`Promise`\<[`ApiClientResponse`](../interfaces/ApiClientResponse.md)\<`T`\>\>
