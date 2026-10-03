[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/database](../README.md) / parseDatabaseIdentity

# Function: parseDatabaseIdentity()

> **parseDatabaseIdentity**(`url`): [`DatabaseIdentity`](../interfaces/DatabaseIdentity.md) \| `null`

Parses a Postgres URL into a redacted identity. The user name, password
and query string never leave this function. Returns null for anything
that is not a postgres:// URL.

## Parameters

### url

`string` \| `undefined`

## Returns

[`DatabaseIdentity`](../interfaces/DatabaseIdentity.md) \| `null`
