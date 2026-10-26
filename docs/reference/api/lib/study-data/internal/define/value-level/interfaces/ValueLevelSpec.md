[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/define/value-level](../README.md) / ValueLevelSpec

# Interface: ValueLevelSpec

One dataset's value-level metadata spec.

## Properties

### by

> `readonly` **by**: `string`

The variable whose value selects the parameter, for example `VSTESTCD`.

***

### derived?

> `readonly` `optional` **derived?**: `Readonly`\<`Record`\<`string`, \{ `method`: `string`; `variables`: readonly `string`[]; \}\>\>

Parameters whose values are derived rather than carried from a
predecessor, with the variables that are derived and the method that
derives them, for example ADEG's QTcF.

***

### variables

> `readonly` **variables**: readonly `string`[]

The variables described per parameter, in dataset order.
