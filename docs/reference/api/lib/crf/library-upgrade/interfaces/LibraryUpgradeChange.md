[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/library-upgrade](../README.md) / LibraryUpgradeChange

# Interface: LibraryUpgradeChange

One difference between the source, current and incoming versions.

## Properties

### action

> **action**: [`LibraryUpgradeAction`](../type-aliases/LibraryUpgradeAction.md)

***

### current?

> `optional` **current?**: `string`

***

### elementId

> **elementId**: `string`

Library identity of the element (`"section"` for the section itself).

***

### id

> **id**: `string`

Stable identifier, used as the key for a conflict resolution.

***

### incoming?

> `optional` **incoming?**: `string`

***

### kind

> **kind**: [`LibraryUpgradeChangeKind`](../type-aliases/LibraryUpgradeChangeKind.md)

***

### label

> **label**: `string`

Readable name of the element.

***

### property?

> `optional` **property?**: `string`

The property that differs; absent when the element is added or removed.

***

### scope

> **scope**: [`LibraryUpgradeScope`](../type-aliases/LibraryUpgradeScope.md)

***

### source?

> `optional` **source?**: `string`

Display value in each version; `undefined` means absent.

***

### studyElementId?

> `optional` **studyElementId?**: `string`

Study identity of the element, when the study holds it.

***

### summary

> **summary**: `string`
