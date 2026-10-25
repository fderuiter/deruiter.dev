[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/env](../README.md) / isProductionBuild

# Function: isProductionBuild()

> **isProductionBuild**(): `boolean`

Reports whether this is a production build, in the browser as on the server.

Next inlines `process.env.NODE_ENV` at build time only where it is written
out like this. `env.NODE_ENV` is parsed from the whole `process.env`
object, which a browser bundle does not carry, so in client code it reads
the schema's default, "development", even in a production build.

## Returns

`boolean`
