[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/personal-library](../README.md) / loadPersonalLibrary

# Function: loadPersonalLibrary()

> **loadPersonalLibrary**(`storage?`): [`LoadLibraryResult`](../type-aliases/LoadLibraryResult.md)

Reads the personal library. A present-but-unreadable payload is copied to
[PERSONAL\_LIBRARY\_CORRUPT\_BACKUP\_KEY](../variables/PERSONAL_LIBRARY_CORRUPT_BACKUP_KEY.md) for manual recovery rather than
being silently overwritten.

## Parameters

### storage?

[`RawStorage`](../../../safe-storage/type-aliases/RawStorage.md)

## Returns

[`LoadLibraryResult`](../type-aliases/LoadLibraryResult.md)
