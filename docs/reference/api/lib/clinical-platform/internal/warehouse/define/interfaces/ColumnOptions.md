[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/define](../README.md) / ColumnOptions

# Interface: ColumnOptions

Optional settings of one column.

## Properties

### classification?

> `readonly` `optional` **classification?**: [`DataClassification`](../../../../types/type-aliases/DataClassification.md)

Classification, when it differs from the table's.

***

### from?

> `readonly` `optional` **from?**: readonly `string`[]

Source columns. A name without a dot is a column of the table's
`source`. Default: the column of the same name in `source` (for silver,
the bronze field in camel case); `[]` marks a generated column.

***

### how?

> `readonly` `optional` **how?**: `string`

Transformation. Default `identity`, or `generated` without sources.

***

### length?

> `readonly` `optional` **length?**: `number`

Maximum string length. Default 64 for strings.

***

### nullable?

> `readonly` `optional` **nullable?**: `boolean`

May hold `null`. Default `false`.

***

### precision?

> `readonly` `optional` **precision?**: `number`

Decimal precision and scale. Default 12 and 4 for decimals.

***

### ref?

> `readonly` `optional` **ref?**: `string`

Foreign key target as `layer.table.column`.

***

### scale?

> `readonly` `optional` **scale?**: `number`
