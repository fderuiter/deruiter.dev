[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/database](../README.md) / resolvePrismaDatabaseUrl

# Function: resolvePrismaDatabaseUrl()

> **resolvePrismaDatabaseUrl**(`fileValues`, `processEnv`): `string` \| `undefined`

Resolves the URL Prisma's CLI will actually connect to, mirroring
`prisma.config.ts`: the replay overrides first (process environment
only, because replay mode skips `.env.local`), then the direct endpoints,
then the pooled one. A variable already in the process environment wins
over `.env.local`, exactly as dotenv does. Checking any other URL would
let the production guard inspect one database while Prisma mutates
another.

## Parameters

### fileValues

`Readonly`\<`Record`\<`string`, `string`\>\>

### processEnv

`Readonly`\<`Record`\<`string`, `string` \| `undefined`\>\>

## Returns

`string` \| `undefined`
