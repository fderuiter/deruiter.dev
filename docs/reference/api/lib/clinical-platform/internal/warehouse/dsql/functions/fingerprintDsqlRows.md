[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/dsql](../README.md) / fingerprintDsqlRows

# Function: fingerprintDsqlRows()

> **fingerprintDsqlRows**(`table`, `rows`): `string`

Fingerprints rows read back from DSQL with a table's `readback` query,
the same way `planDsqlLoad` fingerprints the rows it loads, so equal
fingerprints mean equal contents whatever order the rows come back in.
The fingerprint is a change detector, not a cryptographic hash.

## Parameters

### table

[`WarehouseTable`](../../../../types/platform/interfaces/WarehouseTable.md)

The table the rows came from.

### rows

readonly `Readonly`\<`Record`\<`string`, `string` \| `null`\>\>[]

Read-back rows, each column as text or `null`.

## Returns

`string`

The fingerprint: row count, text length and an FNV-1a hash.
