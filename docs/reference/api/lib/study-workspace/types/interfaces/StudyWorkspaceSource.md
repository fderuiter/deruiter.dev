[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-workspace/types](../README.md) / StudyWorkspaceSource

# Interface: StudyWorkspaceSource

Where the study came from. Never edited after import.

## Properties

### fileName

> `readonly` **fileName**: `string` \| `null`

The file name the person opened, when there was one.

***

### original

> `readonly` **original**: `unknown`

The imported document exactly as parsed.

***

### sha256

> `readonly` **sha256**: `string`

SHA-256 of the imported document's canonical JSON.

***

### systemName

> `readonly` **systemName**: `string` \| `null`

`systemName` the producing tool wrote, or null.

***

### systemVersion

> `readonly` **systemVersion**: `string` \| `null`

`systemVersion` the producing tool wrote, or null.

***

### usdmVersion

> `readonly` **usdmVersion**: `string`

`usdmVersion` of the imported document.
