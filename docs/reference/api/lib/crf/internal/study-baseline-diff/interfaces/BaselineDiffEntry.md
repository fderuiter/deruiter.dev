[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/study-baseline-diff](../README.md) / BaselineDiffEntry

# Interface: BaselineDiffEntry

## Properties

### affectedUses?

> `optional` **affectedUses?**: `string`[]

Readable descriptions of dependents (rules, formulas, form assignments)
still referencing this object as of the baseline snapshot — preserved
even when the object itself was deleted so reviewers keep that context.

***

### breadcrumb

> **breadcrumb**: `string`[]

Breadcrumb trail for display, e.g. ["Vitals Signs", "Systolic BP"].

***

### category

> **category**: [`BaselineDiffCategory`](../type-aliases/BaselineDiffCategory.md)

***

### changedFields?

> `optional` **changedFields?**: `string`[]

Attribute names that differ (only present for "modified" entries).

***

### changeType

> **changeType**: [`BaselineDiffChangeType`](../type-aliases/BaselineDiffChangeType.md)

***

### formId?

> `optional` **formId?**: `string`

Navigation hints so a UI can jump to the changed object.

***

### id

> **id**: `string`

Stable identity of the changed object (or a synthetic key for scalar metadata).

***

### label

> **label**: `string`

***

### navigationMode?

> `optional` **navigationMode?**: `"rules"` \| `"designer"` \| `"matrix"`

***

### newValue?

> `optional` **newValue?**: `unknown`

***

### oldValue?

> `optional` **oldValue?**: `unknown`

***

### sectionId?

> `optional` **sectionId?**: `string`

***

### visitId?

> `optional` **visitId?**: `string`
