[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/define/model](../README.md) / DefineItemRef

# Interface: DefineItemRef

One `ItemRef`, in a dataset or in a value list.

## Properties

### itemOid

> `readonly` **itemOid**: `string`

***

### keySequence?

> `readonly` `optional` **keySequence?**: `number`

One-based position among the dataset keys.

***

### mandatory

> `readonly` **mandatory**: `boolean`

***

### methodOid?

> `readonly` `optional` **methodOid?**: `string`

***

### name

> `readonly` **name**: `string`

Variable name, for readers of the model.

***

### orderNumber

> `readonly` **orderNumber**: `number`

***

### role?

> `readonly` `optional` **role?**: [`VariableRole`](../../../../types/type-aliases/VariableRole.md)

SDTM variable role.

***

### whereClauseOid?

> `readonly` `optional` **whereClauseOid?**: `string`

The where clause a value-level reference applies under.
