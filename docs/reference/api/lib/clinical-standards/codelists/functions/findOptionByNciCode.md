[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/codelists](../README.md) / findOptionByNciCode

# Function: findOptionByNciCode()

> **findOptionByNciCode**(`codelist`, `nciCode`, `codelists?`): [`CodelistOption`](../interfaces/CodelistOption.md) \| `undefined`

Finds an option within a codelist by its NCI Concept Code (e.g. "C49488", "C20197").

## Parameters

### codelist

`string` \| [`CodelistDefinition`](../interfaces/CodelistDefinition.md)

### nciCode

`string`

### codelists?

[`CodelistDefinition`](../interfaces/CodelistDefinition.md)[] = `STANDARD_CODELISTS`

## Returns

[`CodelistOption`](../interfaces/CodelistOption.md) \| `undefined`
