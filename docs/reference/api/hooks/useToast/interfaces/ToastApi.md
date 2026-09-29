[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useToast](../README.md) / ToastApi

# Interface: ToastApi

Imperative toast API returned by `useToast`.

## Properties

### dismiss

> **dismiss**: (`id?`) => `void`

Removes a toast by id, or every visible toast when no id is given.

#### Parameters

##### id?

`string`

#### Returns

`void`

***

### error

> **error**: (`message`, `options?`) => `string`

Enqueues an error toast (announced assertively).

#### Parameters

##### message

`string`

##### options?

[`ToastOptions`](ToastOptions.md)

#### Returns

`string`

***

### info

> **info**: (`message`, `options?`) => `string`

Enqueues an informational toast (announced politely).

#### Parameters

##### message

`string`

##### options?

[`ToastOptions`](ToastOptions.md)

#### Returns

`string`

***

### show

> **show**: (`variant`, `message`, `options?`) => `string`

Enqueues a toast of the given variant and returns its id.

#### Parameters

##### variant

[`ToastVariant`](../type-aliases/ToastVariant.md)

##### message

`string`

##### options?

[`ToastOptions`](ToastOptions.md)

#### Returns

`string`

***

### success

> **success**: (`message`, `options?`) => `string`

Enqueues a success toast (announced politely).

#### Parameters

##### message

`string`

##### options?

[`ToastOptions`](ToastOptions.md)

#### Returns

`string`

***

### warning

> **warning**: (`message`, `options?`) => `string`

Enqueues a warning toast (announced politely).

#### Parameters

##### message

`string`

##### options?

[`ToastOptions`](ToastOptions.md)

#### Returns

`string`
