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

### also?

> `optional` **also?**: `string`[]

Pages that belong under the group but are not menu entries.

***

### href

> **href**: `string`

Where the label goes when it is a plain link, or the menu's overview.

***

### id

> **id**: `"arcade"` \| `"work"` \| `"blog"` \| `"simulators"` \| `"about"` \| `"contact"`

***

### label

> **label**: `string`

***

### sections

> **sections**: [`NavSection`](NavSection.md)[]

Menu contents. A group with no sections is a plain link.
