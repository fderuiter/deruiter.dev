[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / ContractObject

# Interface: ContractObject

One table or dataset a data contract covers.

## Properties

### columns

> `readonly` **columns**: readonly [`ContractColumn`](ContractColumn.md)[]

Columns, in table order.

***

### description

> `readonly` **description**: `string`

One sentence on what the object holds.

***

### grain

> `readonly` **grain**: `string`

What one row stands for.

***

### name

> `readonly` **name**: `string`

Object name, for example `edc_subject` or `ADSL`.

***

### physicalName

> `readonly` **physicalName**: `string`

Where the object is stored: a warehouse table such as
`silver.edc_subject`, or a Dataset-JSON file of the study data package.

***

### primaryKey

> `readonly` **primaryKey**: readonly `string`[]

Columns that identify a row, in key order.
