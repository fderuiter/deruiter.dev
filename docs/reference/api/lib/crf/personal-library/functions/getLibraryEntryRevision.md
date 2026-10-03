[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/personal-library](../README.md) / getLibraryEntryRevision

# Function: getLibraryEntryRevision()

> **getLibraryEntryRevision**(`entry`, `version`): [`PersonalLibraryEntryRevision`](../interfaces/PersonalLibraryEntryRevision.md) \| `undefined`

Returns the content of one version of an entry: the entry itself when the
version is current, an earlier revision when one was kept, and `undefined`
when that version's content is not known.

## Parameters

### entry

[`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md)

### version

`number`

## Returns

[`PersonalLibraryEntryRevision`](../interfaces/PersonalLibraryEntryRevision.md) \| `undefined`
