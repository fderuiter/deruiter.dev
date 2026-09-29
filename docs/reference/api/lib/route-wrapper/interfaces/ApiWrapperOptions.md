[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/route-wrapper](../README.md) / ApiWrapperOptions

# Interface: ApiWrapperOptions\<TSchema\>

## Type Parameters

### TSchema

`TSchema` *extends* `ZodSchema` = `ZodSchema`

## Properties

### auth?

> `optional` **auth?**: [`ApiAuthRequirement`](../type-aliases/ApiAuthRequirement.md)

***

### customJsonError?

> `optional` **customJsonError?**: `string`

***

### customValidationError?

> `optional` **customValidationError?**: (`error`, `req`) => `object`

#### Parameters

##### error

`unknown`

##### req

`NextRequest`

#### Returns

`object`

##### details?

> `optional` **details?**: `object`[]

##### error

> **error**: `string`

***

### defaultStatus?

> `optional` **defaultStatus?**: `number`

***

### packages?

> `optional` **packages?**: `string`[]

Package dependencies required by this endpoint data path.
If any listed package is flagged by an active unpatched CVE rule in the security manifest,
the runtime circuit breaker trips and sheds traffic (HTTP 503 Service Unavailable).

***

### retryAfterSeconds?

> `optional` **retryAfterSeconds?**: `number`

Optional custom retry-after window in seconds (default: 300 seconds).

***

### schema?

> `optional` **schema?**: `TSchema`

***

### type?

> `optional` **type?**: `"body"` \| `"query"`
