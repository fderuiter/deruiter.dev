[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/database](../README.md) / schemaCommandFor

# Function: schemaCommandFor()

> **schemaCommandFor**(`identity`): `string`[]

How the schema reaches a target. A local database is disposable, so it
gets `prisma db push`, which syncs the schema without writing migration
history. Any hosted database gets `prisma migrate deploy`, the committed
migration workflow production uses, so its history never diverges.

## Parameters

### identity

[`DatabaseIdentity`](../interfaces/DatabaseIdentity.md)

## Returns

`string`[]
