[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/library-upgrade](../README.md) / insertLibraryEntryWithLineage

# Function: insertLibraryEntryWithLineage()

> **insertLibraryEntryWithLineage**(`entry`, `study`, `formId`, `now?`): `object`

Inserts a library entry into a form and records its lineage, so the block
can later be compared with newer library versions. Returns a new study; the
one passed in is not mutated.

## Parameters

### entry

[`PersonalLibraryEntry`](../../personal-library/interfaces/PersonalLibraryEntry.md)

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### formId

`string`

### now?

`Date`

## Returns

`object`

### study

> **study**: [`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### use

> **use**: [`StudyLibraryUse`](../../types/interfaces/StudyLibraryUse.md)
