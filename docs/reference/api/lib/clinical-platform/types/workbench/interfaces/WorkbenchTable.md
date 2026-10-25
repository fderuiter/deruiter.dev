[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/workbench](../README.md) / WorkbenchTable

# Interface: WorkbenchTable

One table the SQL workbench loads, with the governance its contract records (#2633).

## Properties

### classification

> `readonly` **classification**: [`DataClassification`](../../platform/type-aliases/DataClassification.md)

Highest classification of any column.

***

### columns

> `readonly` **columns**: readonly [`WorkbenchColumn`](WorkbenchColumn.md)[]

***

### contractVersion

> `readonly` **contractVersion**: `string`

Version of the data contract in force.

***

### description

> `readonly` **description**: `string`

***

### grain

> `readonly` **grain**: `string`

What one row stands for.

***

### kind

> `readonly` **kind**: [`WarehouseTableKind`](../../platform/type-aliases/WarehouseTableKind.md)

***

### name

> `readonly` **name**: `string`

Qualified name, as a query writes it, for example `gold.fct_query`.

***

### owner

> `readonly` **owner**: `string`

Accountable owner and data steward (roles, not people).

***

### personalHealthData

> `readonly` **personalHealthData**: `boolean`

Whether rows describe study subjects. The data is synthetic.

***

### primaryKey

> `readonly` **primaryKey**: readonly `string`[]

***

### rowCount

> `readonly` **rowCount**: `number`

Rows in the seeded warehouse.

***

### steward

> `readonly` **steward**: `string`
