[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/personal-library](../README.md) / listLibraryEntries

# Function: listLibraryEntries()

> **listLibraryEntries**(`storage?`): [`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md)[]

Lists saved entries, newest first. A corrupt or absent library reads as an
empty list so callers can render without special-casing.

## Parameters

### storage?

[`RawStorage`](../../../safe-storage/type-aliases/RawStorage.md)

## Returns

[`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md)[]
