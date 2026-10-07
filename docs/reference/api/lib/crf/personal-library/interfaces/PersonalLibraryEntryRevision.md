[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/personal-library](../README.md) / PersonalLibraryEntryRevision

# Interface: PersonalLibraryEntryRevision

The content of one earlier version of a library entry, kept so an upgrade
can compare what a study used with what the library holds now.

## Properties

### assumptions?

> `optional` **assumptions?**: `string`

***

### codelists

> **codelists**: [`CodelistDefinition`](../../types/interfaces/CodelistDefinition.md)[]

***

### description?

> `optional` **description?**: `string`

***

### form?

> `optional` **form?**: [`CRFForm`](../../types/interfaces/CRFForm.md)

***

### kind?

> `optional` **kind?**: `"form"` \| `"section"`

***

### name

> **name**: `string`

***

### rules

> **rules**: [`EditCheckRule`](../../types/interfaces/EditCheckRule.md)[]

***

### section?

> `optional` **section?**: [`CRFSection`](../../types/interfaces/CRFSection.md)

***

### updatedAt

> **updatedAt**: `string`

***

### version

> **version**: `number`
