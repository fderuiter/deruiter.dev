[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/library-upgrade](../README.md) / LibraryUpgradePreview

# Interface: LibraryUpgradePreview

## Properties

### affectedReferences

> **affectedReferences**: [`LibraryAffectedReference`](LibraryAffectedReference.md)[]

***

### changes

> **changes**: [`LibraryUpgradeChange`](LibraryUpgradeChange.md)[]

***

### conflicts

> **conflicts**: [`LibraryUpgradeChange`](LibraryUpgradeChange.md)[]

The changes that need an explicit resolution.

***

### counts

> **counts**: [`LibraryUpgradeCounts`](LibraryUpgradeCounts.md)

***

### entryId

> **entryId**: `string`

***

### entryName

> **entryName**: `string`

***

### fingerprint

> **fingerprint**: `string`

Digest of the study and library content the preview was computed from.
[applyLibraryUpgrade](../functions/applyLibraryUpgrade.md) refuses to apply when it no longer matches.

***

### formId

> **formId**: `string`

***

### fromVersion

> **fromVersion**: `number`

***

### sectionId

> **sectionId**: `string`

***

### toVersion

> **toVersion**: `number`

***

### useId

> **useId**: `string`
