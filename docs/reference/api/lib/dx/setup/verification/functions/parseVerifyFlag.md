[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/verification](../README.md) / parseVerifyFlag

# Function: parseVerifyFlag()

> **parseVerifyFlag**(`value`): `object`

Parses `--verify`. A bare flag means every level; a comma list picks
levels; unknown names are returned so the caller can reject them.

## Parameters

### value

`string` \| `boolean` \| `undefined`

## Returns

`object`

### levels

> **levels**: (`"quality"` \| `"static"` \| `"env"` \| `"prisma"` \| `"db"` \| `"providers"` \| `"doctor"`)[]

### unknown

> **unknown**: `string`[]
