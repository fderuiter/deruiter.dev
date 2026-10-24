[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsListItem

# Interface: ArsListItem

One entry of the list of contents: an output with its analyses.

## Properties

### analysisId?

> `readonly` `optional` **analysisId?**: `string`

The analysis, for a level 2 entry.

***

### level

> `readonly` **level**: `number`

Nesting level, from 1.

***

### name

> `readonly` **name**: `string`

Name shown in the list.

***

### order

> `readonly` **order**: `number`

Position among its siblings, from 1.

***

### outputId?

> `readonly` `optional` **outputId?**: `string`

The output, for a level 1 entry.

***

### sublist?

> `readonly` `optional` **sublist?**: `object`

Nested entries.

#### listItems

> `readonly` **listItems**: readonly `ArsListItem`[]
