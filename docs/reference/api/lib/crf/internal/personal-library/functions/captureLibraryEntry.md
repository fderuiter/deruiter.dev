[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/personal-library](../README.md) / captureLibraryEntry

# Function: captureLibraryEntry()

> **captureLibraryEntry**(`options`): [`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md)

Captures a section of a form into a new library entry, pulling in the rules
and codelists it depends on and recording where it came from.

The returned entry owns deep copies, so later edits to the source study
cannot mutate the saved block.

## Parameters

### options

#### assumptions?

`string`

#### description?

`string`

#### form

[`CRFForm`](../../../types/interfaces/CRFForm.md)

#### name?

`string`

#### now?

`Date`

#### sectionId

`string`

#### study

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

## Returns

[`PersonalLibraryEntry`](../interfaces/PersonalLibraryEntry.md)
