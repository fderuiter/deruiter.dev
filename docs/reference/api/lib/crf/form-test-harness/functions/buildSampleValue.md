[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-test-harness](../README.md) / buildSampleValue

# Function: buildSampleValue()

> **buildSampleValue**(`field`, `index`, `codelists?`): `string` \| `number` \| `boolean` \| `null`

Deterministic sample value for one field.

Deterministic rather than random on purpose: an author comparing two runs
needs the difference to come from their edits, not from the sample data
moving underneath them, and a test can assert exact values.

Pass `codelists` so coded fields receive a genuine member of their own
codelist. Omitting it falls back to a placeholder, which is legible but
cannot feed a calculation that expects a coded numeric score.

## Parameters

### field

[`CRFField`](../../types/interfaces/CRFField.md)

### index

`number`

### codelists?

[`CodelistDefinition`](../../../clinical-standards/codelists/interfaces/CodelistDefinition.md)[]

## Returns

`string` \| `number` \| `boolean` \| `null`
