[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/dx/setup/providers/publish](../README.md) / CommandRunner

# Type Alias: CommandRunner

> **CommandRunner** = (`command`, `args`, `options?`) => `Promise`\<[`CommandResult`](../interfaces/CommandResult.md)\>

Runs a command without a shell. `input` is written to stdin, which is how
every credential reaches a CLI: never as an argument, where it would show
up in process listings and shell history.

## Parameters

### command

`string`

### args

readonly `string`[]

### options?

#### cwd?

`string`

#### input?

`string`

## Returns

`Promise`\<[`CommandResult`](../interfaces/CommandResult.md)\>
