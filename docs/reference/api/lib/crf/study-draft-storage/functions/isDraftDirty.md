[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-draft-storage](../README.md) / isDraftDirty

# Function: isDraftDirty()

> **isDraftDirty**(`current`, `baseline?`, `storage?`): `boolean`

Evaluates whether the current study draft differs from a saved baseline protocol
or the active storage draft if baseline is not explicitly provided.

## Parameters

### current

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### baseline?

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md) \| `null`

### storage?

[`RawStorage`](../../../safe-storage/type-aliases/RawStorage.md)

## Returns

`boolean`
