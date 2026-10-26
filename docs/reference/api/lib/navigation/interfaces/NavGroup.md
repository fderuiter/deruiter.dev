[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/navigation](../README.md) / NavGroup

# Interface: NavGroup

One entry in the top bar.

## Properties

### activeWhen

> **activeWhen**: `object`

Paths and path prefixes that mark the group as the current one.

#### exact?

> `optional` **exact?**: `string`[]

#### prefixes?

> `optional` **prefixes?**: `string`[]

***

### href

> **href**: `string`

Where the label goes when it is a plain link, or the menu's overview.

***

### id

> **id**: `"arcade"` \| `"clinical"` \| `"labs"` \| `"writing"` \| `"about"` \| `"contact"`

***

### label

> **label**: `string`

***

### noBreadcrumb?

> `optional` **noBreadcrumb?**: `boolean`

The group has no overview page of its own (its href is its first entry),
so it adds no parent crumb to the pages it lists.

***

### overviewLabel?

> `optional` **overviewLabel?**: `string`

Text of the link to the group's own overview page, shown at the foot of
its menu. Omitted when the overview is already a menu entry or a section
of another page.

***

### sections

> **sections**: [`NavSection`](NavSection.md)[]

Menu contents. A group with no sections is a plain link.
