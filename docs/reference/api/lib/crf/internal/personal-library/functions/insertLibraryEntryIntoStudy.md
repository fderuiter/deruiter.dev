[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/personal-library](../README.md) / insertLibraryEntryIntoStudy

# Function: insertLibraryEntryIntoStudy()

> **insertLibraryEntryIntoStudy**(`entry`, `study`, `formId`, `now?`): `object`

Inserts an entry into a form of a study, returning a new study rather than
mutating the one passed in.

The inserted section, its rules and any genuinely new codelists are added
together, so a caller commits the whole insertion or none of it.

## Parameters

### entry

[`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md)

### study

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

### formId

`string`

### now?

`Date`

## Returns

`object`

### instantiated

> **instantiated**: [`InstantiatedLibraryEntry`](../interfaces/InstantiatedLibraryEntry.md)

### study

> **study**: [`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)
