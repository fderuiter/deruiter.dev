[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/db](../README.md) / resolveRuntimeDatabaseUrl

# Function: resolveRuntimeDatabaseUrl()

> **resolveRuntimeDatabaseUrl**(`source`): `string` \| `undefined`

Chooses the connection string the running site uses.

APP_DATABASE_URL connects as the least-privilege `app_runtime` role, which
may read and write rows but cannot change the schema (#3036). Migrations keep
the owner role through DATABASE_URL_UNPOOLED in prisma.config.ts, and
DATABASE_URL stays the fallback so an environment without the runtime role
keeps working.

## Parameters

### source

Validated environment values.

#### APP_DATABASE_URL?

`string`

#### DATABASE_URL?

`string`

## Returns

`string` \| `undefined`

The connection string, or undefined when neither is set.
