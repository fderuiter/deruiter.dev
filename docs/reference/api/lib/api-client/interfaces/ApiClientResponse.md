[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/api-client](../README.md) / ApiClientResponse

# Interface: ApiClientResponse\<T\>

Uniform result of an [apiClient](../variables/apiClient.md) call.

## Type Parameters

### T

`T`

## Properties

### body

> **body**: `unknown`

Parsed JSON body regardless of status (useful when an error response also carries data); `null` when empty or not JSON.

***

### data

> **data**: `T` \| `null`

Parsed JSON body of a successful (2xx) response; `null` otherwise or when the body is empty or not JSON.

***

### details

> **details**: [`ApiErrorDetail`](ApiErrorDetail.md)[]

Field-level `details` from the error envelope; empty when absent or malformed.

***

### error

> **error**: `string` \| `null`

Server-supplied `error` string from the envelope of a failed response.
`null` when the request succeeded or the server sent no usable message
(non-JSON body, network failure), so callers can supply their own copy.

***

### headers

> **headers**: `Headers`

Server response headers, or empty Headers when no response was received.

***

### networkError

> **networkError**: `boolean`

`true` when `fetch` itself rejected (offline, DNS, CORS, abort).

***

### ok

> **ok**: `boolean`

`true` for a 2xx response.

***

### status

> **status**: `number`

HTTP status code, or `0` when no response was received.
