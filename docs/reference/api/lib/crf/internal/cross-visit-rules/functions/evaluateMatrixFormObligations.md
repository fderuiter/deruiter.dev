[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/cross-visit-rules](../README.md) / evaluateMatrixFormObligations

# Function: evaluateMatrixFormObligations()

> **evaluateMatrixFormObligations**(`visits`, `rules`, `fieldValues`): [`StudyVisit`](../../../types/interfaces/StudyVisit.md)[]

Resolves form requirements per visit schedule based on subject treatment arm or clinical criteria.

## Parameters

### visits

[`StudyVisit`](../../../types/interfaces/StudyVisit.md)[]

### rules

[`ConditionalFormRule`](../interfaces/ConditionalFormRule.md)[]

### fieldValues

`Record`\<`string`, `string` \| `number` \| `boolean` \| `null` \| `undefined`\>

## Returns

[`StudyVisit`](../../../types/interfaces/StudyVisit.md)[]
