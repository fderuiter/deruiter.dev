[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/types](../README.md) / StudyLibraryUse

# Interface: StudyLibraryUse

Lineage of one personal-library block inside a study (#681): which entry
and version it came from, and how the library's identities map onto the
study's, so a later version can be compared three ways.

## Properties

### entryId

> **entryId**: `string`

***

### entryName

> **entryName**: `string`

***

### entryVersion

> **entryVersion**: `number`

The library version the study's copy is currently based on.

***

### formId

> **formId**: `string`

***

### id

> **id**: `string`

***

### idMap

> **idMap**: `Record`\<`string`, `string`\>

Library identity to study identity, for the section, fields and rules.

***

### insertedAt

> **insertedAt**: `string`

When the block was first inserted. Kept unchanged across upgrades.

***

### sectionId

> **sectionId**: `string`

The study section holding the block.

***

### upgradeHistory?

> `optional` **upgradeHistory?**: [`StudyLibraryUpgradeRecord`](StudyLibraryUpgradeRecord.md)[]

Earlier upgrades, oldest first.

***

### variableMap

> **variableMap**: `Record`\<`string`, `string`\>

Library variable name to study variable name, for names the study took
from the library. A name the author customized has no entry.
