[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/personal-library](../README.md) / insertFormLibraryEntryIntoStudy

# Function: insertFormLibraryEntryIntoStudy()

> **insertFormLibraryEntryIntoStudy**(`entry`, `study`, `targetVisitId?`, `now?`): `object`

Inserts a custom form template into a study, adding its instantiated form,
rules, and codelists, and optionally assigning it to a study visit.

## Parameters

### entry

[`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md)

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### targetVisitId?

`string`

### now?

`Date`

## Returns

`object`

### instantiated

> **instantiated**: [`InstantiatedFormLibraryEntry`](../interfaces/InstantiatedFormLibraryEntry.md)

### study

> **study**: [`StudyProtocol`](../../types/interfaces/StudyProtocol.md)
