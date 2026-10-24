[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/cdisc-controlled-terminology](../README.md) / validateCodelists

# Function: validateCodelists()

> **validateCodelists**(`codelists?`): `object`

Validates a list of codelists for integrity:
- Checks for duplicate codelist IDs.
- Checks for duplicate NCI codelist concept codes.
- Validates NCI C-code regex formatting.
- Checks option uniqueness and option NCI code formats within each codelist.
- Rejects NCI term codes on a sponsor-defined codelist (one without an NCI
  codelist code), since such a code would be borrowed from another concept.

Terms without an NCI code are allowed in a CDISC codelist: they are sponsor
extensions of an extensible codelist.

## Parameters

### codelists?

[`CodelistDefinition`](../../types/interfaces/CodelistDefinition.md)[] = `STANDARD_CODELISTS`

## Returns

`object`

### errors

> **errors**: `string`[]

### valid

> **valid**: `boolean`
