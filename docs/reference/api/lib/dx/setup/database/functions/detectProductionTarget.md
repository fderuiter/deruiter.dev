[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/database](../README.md) / detectProductionTarget

# Function: detectProductionTarget()

> **detectProductionTarget**(`identity`, `context`): `string`[]

Flags obvious production targets. This is a guard, not a proof: a hosted
database with a neutral name is not detected, which is why every hosted
mutation also asks first.

## Parameters

### identity

[`DatabaseIdentity`](../interfaces/DatabaseIdentity.md)

### context

#### nodeEnv?

`string`

#### profileAllowsMutation

`boolean`

#### vercelEnv?

`string`

## Returns

`string`[]
