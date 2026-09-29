[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/sentry-policy](../README.md) / SENTRY\_DATA\_COLLECTION

# Variable: SENTRY\_DATA\_COLLECTION

> `const` **SENTRY\_DATA\_COLLECTION**: `object`

Sentry 11 removed `sendDefaultPii` and now collects user info, cookies,
headers, bodies and query parameters unless told otherwise. This is the
explicit opt-out that preserves the previous `sendDefaultPii: false`
behaviour at every init site.

## Type Declaration

### cookies

> **cookies**: `boolean`

### httpBodies

> **httpBodies**: `never`[]

### httpHeaders

> **httpHeaders**: `boolean`

### urlQueryParams

> **urlQueryParams**: `boolean`

### userInfo

> **userInfo**: `boolean`
