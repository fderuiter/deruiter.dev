[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/internal/policy](../README.md) / checkRegulatoryWording

# Function: checkRegulatoryWording()

> **checkRegulatoryWording**(`text`): [`PolicyFinding`](../../../types/platform/interfaces/PolicyFinding.md)[]

Finds compliance or validation claims in page copy. Platform pages say
"designed to these controls"; they never call the platform compliant or
validated. The sanctioned disclaimer is allowed.

## Parameters

### text

`string`

Copy to check.

## Returns

[`PolicyFinding`](../../../types/platform/interfaces/PolicyFinding.md)[]

One finding per prohibited word, in order of appearance.
