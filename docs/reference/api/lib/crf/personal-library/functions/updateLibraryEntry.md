[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/personal-library](../README.md) / updateLibraryEntry

# Function: updateLibraryEntry()

> **updateLibraryEntry**(`entryId`, `changes`, `storage?`, `now?`): \{ `entry`: [`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md); `status`: `"updated"`; \} \| \{ `status`: `"missing"`; \}

Applies an edit to a stored entry and increments its version.

Content already inserted into a study is unaffected, because insertions hold
their own deep copies with their own identities.

## Parameters

### entryId

`string`

### changes

`Partial`\<`Pick`\<[`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md), `"name"` \| `"description"` \| `"assumptions"` \| `"section"` \| `"rules"` \| `"codelists"`\>\>

### storage?

[`RawStorage`](../../../safe-storage/type-aliases/RawStorage.md)

### now?

`Date`

## Returns

\{ `entry`: [`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md); `status`: `"updated"`; \} \| \{ `status`: `"missing"`; \}
