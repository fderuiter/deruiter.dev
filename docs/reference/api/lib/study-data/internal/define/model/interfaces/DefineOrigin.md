[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/define/model](../README.md) / DefineOrigin

# Interface: DefineOrigin

Where a variable's values come from (`def:Origin`).

## Properties

### description?

> `readonly` `optional` **description?**: `string`

For example the predecessor variable or the collection field.

***

### source?

> `readonly` `optional` **source?**: `"Investigator"` \| `"Sponsor"`

Who provides the value, for Collected, Derived and Assigned origins.

***

### type

> `readonly` **type**: [`VariableOrigin`](../../../../types/type-aliases/VariableOrigin.md)
