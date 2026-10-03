[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / evaluateProfileReadiness

# Function: evaluateProfileReadiness()

> **evaluateProfileReadiness**(`profile`, `values`, `template?`, `options?`): `object`

Reports which of a profile's required and optional keys still hold no
real value. With `skipDb`, database keys stop being required because
nothing in the run will connect to a database.

## Parameters

### profile

[`SetupProfile`](../interfaces/SetupProfile.md)

### values

`Readonly`\<`Record`\<`string`, `string`\>\>

### template?

`Readonly`\<`Record`\<`string`, `string`\>\> = `{}`

### options?

#### skipDb?

`boolean`

## Returns

`object`

### missingOptional

> **missingOptional**: `string`[]

### missingRequired

> **missingRequired**: `string`[]

### optionalReady

> **optionalReady**: `boolean`

### requiredReady

> **requiredReady**: `boolean`
