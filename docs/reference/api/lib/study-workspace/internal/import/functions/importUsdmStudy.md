[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-workspace/internal/import](../README.md) / importUsdmStudy

# Function: importUsdmStudy()

> **importUsdmStudy**(`input`, `options?`): `Promise`\<[`StudyImportResult`](../../../types/type-aliases/StudyImportResult.md)\>

Imports a USDM v4 document into a new workspace at revision R1.

It rejects what cannot be a USDM v4 study (not an object, another USDM
major version, no study version or design, duplicate ids). Schema issues
do not stop the import; they are listed in the report so the person can
see and fix them. When the document holds more than one study version or
design and no selection is given, it returns the choices instead of
picking the first. Study versions and designs that are not selected, and
every object carrying extension attributes, are listed as preserved: the
workspace keeps them untouched in the document.

## Parameters

### input

\{ `text`: `string`; \} \| \{ `document`: `unknown`; \}

### options?

[`ImportUsdmStudyOptions`](../interfaces/ImportUsdmStudyOptions.md) = `{}`

## Returns

`Promise`\<[`StudyImportResult`](../../../types/type-aliases/StudyImportResult.md)\>
