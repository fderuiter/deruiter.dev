[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/define/model](../README.md) / DefineItem

# Interface: DefineItem

One `ItemDef`: a dataset variable, or one variable for one parameter.

## Properties

### codeListOid?

> `readonly` `optional` **codeListOid?**: `string`

***

### dataset

> `readonly` **dataset**: `string`

Dataset the item belongs to.

***

### dataType

> `readonly` **dataType**: [`DefineDataType`](../type-aliases/DefineDataType.md)

***

### displayFormat?

> `readonly` `optional` **displayFormat?**: `string`

SAS display format, for ADaM dates, datetimes and times.

***

### label

> `readonly` **label**: `string`

Variable label, or for value-level items the parameter and label.

***

### length?

> `readonly` `optional` **length?**: `number`

Maximum length: bytes for text, digits for numbers.

***

### name

> `readonly` **name**: `string`

Variable name.

***

### oid

> `readonly` **oid**: `string`

***

### origin

> `readonly` **origin**: [`DefineOrigin`](DefineOrigin.md)

***

### significantDigits?

> `readonly` `optional` **significantDigits?**: `number`

Digits after the decimal point, for float items.

***

### valueListOid?

> `readonly` `optional` **valueListOid?**: `string`

The value list that refines this variable by parameter.

***

### whereValue?

> `readonly` `optional` **whereValue?**: `string`

For a value-level item, the parameter value it describes.
