[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/test-scenarios](../README.md) / fingerprintForm

# Function: fingerprintForm()

> **fingerprintForm**(`form`): `string`

Fingerprints the parts of a form a scenario's outcome can depend on: its
fields and its rules.

Scoped to the form rather than the whole study on purpose. Editing an
unrelated form should not mark this scenario's evidence stale, or staleness
becomes noise an author learns to ignore.

## Parameters

### form

[`CRFForm`](../../../types/interfaces/CRFForm.md)

## Returns

`string`
