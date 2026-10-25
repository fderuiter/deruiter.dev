[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/env](../README.md) / isProductionBuild

# Function: isProductionBuild()

> **isProductionBuild**(): `boolean`

Reports whether this is a production build, in the browser as on the server.

It reads the inlined `process.env.NODE_ENV` directly, so it needs no schema
parse. `env.NODE_ENV` gives the same answer now that `getEnv` merges the
inlined values (#2780).

## Returns

`boolean`
