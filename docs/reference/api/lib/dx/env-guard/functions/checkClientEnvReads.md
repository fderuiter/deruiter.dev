[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/env-guard](../README.md) / checkClientEnvReads

# Function: checkClientEnvReads()

> **checkClientEnvReads**(`root`): `object`

Static check that client modules read only browser-visible variables
through `env` (#2780).

A browser bundle sees only the variables `getEnv` inlines: `NODE_ENV` and
the keys of `clientEnvSchema`. Any other read in a `"use client"` module
gets the schema default or undefined in the browser, whatever the
deployment sets, so a check like `env.VERCEL_ENV === "production"` would
silently never pass there. Modules without the directive that client code
imports are not covered; keep their reads to the same set.

## Parameters

### root

`string`

Repository root.

## Returns

`object`

One entry per offending read, as `file:line: env.KEY`.

### violations

> **violations**: `string`[]
