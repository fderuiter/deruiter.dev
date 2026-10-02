[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/personal-library](../README.md) / savePersonalLibrary

# Function: savePersonalLibrary()

> **savePersonalLibrary**(`entries`, `storage?`, `now?`): [`SaveLibraryResult`](../type-aliases/SaveLibraryResult.md)

Writes the whole library. Never throws; a full or unavailable store reports
a status so the caller can keep working in memory.

## Parameters

### entries

[`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md)[]

### storage?

[`RawStorage`](../../../safe-storage/type-aliases/RawStorage.md)

### now?

`Date`

## Returns

[`SaveLibraryResult`](../type-aliases/SaveLibraryResult.md)
