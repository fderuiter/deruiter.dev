[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/setup](../README.md) / validateNodeRuntime

# Function: validateNodeRuntime()

> **validateNodeRuntime**(`root?`): `object`

Checks the running Node.js against `engines.node` in the workspace's
`package.json`. Without a declared range, Node 22 or newer is accepted.

## Parameters

### root?

`string`

## Returns

`object`

### currentVersion

> **currentVersion**: `string`

### required

> **required**: `string`

### valid

> **valid**: `boolean`
