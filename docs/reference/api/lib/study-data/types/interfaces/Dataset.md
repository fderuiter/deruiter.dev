[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / Dataset

# Interface: Dataset

A column-oriented table with its variable metadata attached.

## Properties

### class

> `readonly` **class**: `string`

Observation class or ADaM class, for example `Events` or `BDS`.

***

### columns

> `readonly` **columns**: `Readonly`\<`Record`\<`string`, readonly [`CellValue`](../type-aliases/CellValue.md)[]\>\>

One array of values per variable name, each `rowCount` long.

***

### keys

> `readonly` **keys**: readonly `string`[]

Natural key variables, in sort order.

***

### label

> `readonly` **label**: `string`

Dataset label.

***

### layer

> `readonly` **layer**: [`DataLayer`](../type-aliases/DataLayer.md)

The layer the dataset belongs to.

***

### lineage?

> `readonly` `optional` **lineage?**: readonly (readonly `string`[])[]

Source record ids for each row, outside SDTM submission columns.

***

### name

> `readonly` **name**: `string`

Dataset name, for example `DM`, `SUPPDM` or `ADSL`.

***

### rowCount

> `readonly` **rowCount**: `number`

Number of records.

***

### variables

> `readonly` **variables**: readonly [`VariableMeta`](VariableMeta.md)[]

Variable metadata, in dataset column order.
