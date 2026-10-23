[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/conformance/run-conformance](../README.md) / runConformance

# Function: runConformance()

> **runConformance**(`datasets`, `rules?`): [`ConformanceOutcome`](../interfaces/ConformanceOutcome.md)

Safe on malformed dataset structures: returns identifiable errors instead of throwing.

## Parameters

### datasets

readonly [`Dataset`](../../../../types/interfaces/Dataset.md)[]

### rules?

readonly [`ConformanceRule`](../../rules/interfaces/ConformanceRule.md)[] = `CONFORMANCE_RULES`

## Returns

[`ConformanceOutcome`](../interfaces/ConformanceOutcome.md)
