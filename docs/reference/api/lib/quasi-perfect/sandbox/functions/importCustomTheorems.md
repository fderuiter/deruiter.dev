[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/sandbox](../README.md) / importCustomTheorems

# Function: importCustomTheorems()

> **importCustomTheorems**(`theorems`, `json`): [`CustomTheoremImportResult`](../interfaces/CustomTheoremImportResult.md)

Merge theorems from an exported JSON file into the collection. The file
may be an object with a theorems array or a bare array. Each entry gets a
fresh id; ids in the file are ignored. Entries whose formula or
hypotheses do not parse, entries whose trimmed formula and hypotheses are
already in the collection or earlier in the file, and entries past
[MAX\_CUSTOM\_THEOREMS](../variables/MAX_CUSTOM_THEOREMS.md) are skipped with a warning each.

## Parameters

### theorems

readonly [`CustomTheorem`](../interfaces/CustomTheorem.md)[]

The saved collection.

### json

`string`

The file contents.

## Returns

[`CustomTheoremImportResult`](../interfaces/CustomTheoremImportResult.md)

The merged collection, the number added and any warnings.
