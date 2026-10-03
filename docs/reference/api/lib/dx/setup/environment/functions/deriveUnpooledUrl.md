[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / deriveUnpooledUrl

# Function: deriveUnpooledUrl()

> **deriveUnpooledUrl**(`databaseUrl`): `string` \| `null`

Derives the direct (unpooled) Postgres endpoint from a pooled one. Neon
marks its pooler with a `-pooler` host suffix; other providers usually
expose one endpoint, so the URL is returned unchanged.

## Parameters

### databaseUrl

`string`

## Returns

`string` \| `null`
