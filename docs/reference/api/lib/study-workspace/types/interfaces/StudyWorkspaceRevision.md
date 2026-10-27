[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-workspace/types](../README.md) / StudyWorkspaceRevision

# Interface: StudyWorkspaceRevision

One immutable revision of the working study.

## Properties

### id

> `readonly` **id**: `string`

`R1` for the import, then `R2`, `R3`, ...

***

### note

> `readonly` **note**: `string`

What changed, in the author's words.

***

### parentId

> `readonly` **parentId**: `string` \| `null`

The revision this one was made from; null for the import.

***

### sha256

> `readonly` **sha256**: `string`

SHA-256 of the working USDM document's canonical JSON.
