[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/ddl](../README.md) / constraintName

# Function: constraintName()

> **constraintName**(`kind`, `table`, `suffix?`): `string`

Name of a constraint, unique across the warehouse and at most 63 characters.

## Parameters

### kind

`"pk"` \| `"uq"` \| `"fk"` \| `"ck"`

### table

[`WarehouseTable`](../../../../types/platform/interfaces/WarehouseTable.md)

### suffix?

`string` = `""`

## Returns

`string`
