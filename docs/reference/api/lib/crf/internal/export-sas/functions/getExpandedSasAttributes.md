[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/export-sas](../README.md) / getExpandedSasAttributes

# Function: getExpandedSasAttributes()

> **getExpandedSasAttributes**(`field`, `study`, `usedNames?`): [`ExpandedSasField`](../interfaces/ExpandedSasField.md)[]

Expands fields, converting multi_select and checkbox fields into individual dichotomous sub-variables.

## Parameters

### field

[`CRFField`](../../../types/interfaces/CRFField.md)

### study

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

### usedNames?

`Set`\<`string`\> = `...`

## Returns

[`ExpandedSasField`](../interfaces/ExpandedSasField.md)[]
