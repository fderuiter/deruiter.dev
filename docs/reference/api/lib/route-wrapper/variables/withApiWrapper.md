[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/route-wrapper](../README.md) / withApiWrapper

# Variable: withApiWrapper

> `const` **withApiWrapper**: \{\<`TSchema`\>(`handler`, `options`): [`ApiRouteHandler`](../type-aliases/ApiRouteHandler.md); (`handler`, `options?`): [`ApiRouteHandler`](../type-aliases/ApiRouteHandler.md); \} = `createApiHandler`

## Call Signature

> \<`TSchema`\>(`handler`, `options`): [`ApiRouteHandler`](../type-aliases/ApiRouteHandler.md)

Higher-order API route handler wrapper.
Provides automated Zod request schema validation, uniform error transformation,
Sentry exception logging, error sanitization, and security header enforcement.

### Type Parameters

#### TSchema

`TSchema` *extends* `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>

### Parameters

#### handler

[`ApiHandler`](../type-aliases/ApiHandler.md)\<`output`\<`TSchema`\>\>

#### options

[`ApiWrapperOptions`](../interfaces/ApiWrapperOptions.md)\<`TSchema`\> & `object`

### Returns

[`ApiRouteHandler`](../type-aliases/ApiRouteHandler.md)

## Call Signature

> (`handler`, `options?`): [`ApiRouteHandler`](../type-aliases/ApiRouteHandler.md)

Higher-order API route handler wrapper.
Provides automated Zod request schema validation, uniform error transformation,
Sentry exception logging, error sanitization, and security header enforcement.

### Parameters

#### handler

[`ApiHandler`](../type-aliases/ApiHandler.md)\<`undefined`\>

#### options?

[`ApiWrapperOptions`](../interfaces/ApiWrapperOptions.md)\<`ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>\>

### Returns

[`ApiRouteHandler`](../type-aliases/ApiRouteHandler.md)
