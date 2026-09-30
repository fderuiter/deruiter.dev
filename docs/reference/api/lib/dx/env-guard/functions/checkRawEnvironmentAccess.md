[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/env-guard](../README.md) / checkRawEnvironmentAccess

# Function: checkRawEnvironmentAccess()

> **checkRawEnvironmentAccess**(`root`): `object`

Static analysis check to detect direct raw process.env reads in application and DX code.
Standalone build scripts (scripts/), config files, test suites (__tests__/), and lib/env.ts are exempted.
All modules in app/, lib/ (including lib/dx/), components/, and hooks/ are audited.

## Parameters

### root

`string`

## Returns

`object`

### violations

> **violations**: `string`[]
