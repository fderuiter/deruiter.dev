[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-omnibar](../README.md) / OmnibarEntry

# Interface: OmnibarEntry

One searchable omnibar row.

## Properties

### action

> **action**: [`OmnibarAction`](../type-aliases/OmnibarAction.md)

***

### category

> **category**: [`OmnibarCategory`](../type-aliases/OmnibarCategory.md)

***

### context

> **context**: `string`

Owning context, e.g. `Demographics (DM) › Subject Information`, or the
insertion target for an insert action.

***

### detail?

> `optional` **detail?**: `string`

Short secondary detail such as a variable name or a domain.

***

### id

> **id**: `string`

Stable, category-prefixed identifier.

***

### keywords

> **keywords**: `string`[]

Extra terms matched by search but not displayed.

***

### title

> **title**: `string`

Primary label, e.g. a form name or a field label.
