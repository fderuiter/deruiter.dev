[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/evaluate](../README.md) / evaluateAnalyses

# Function: evaluateAnalyses()

> **evaluateAnalyses**(`datasets`, `plan`): [`Evaluation`](../interfaces/Evaluation.md)

Runs every analysis in the plan, in order. An analysis whose percentages
use another analysis's counts must come after it.

## Parameters

### datasets

readonly [`Dataset`](../../../../types/interfaces/Dataset.md)[]

### plan

[`ReportingPlan`](../../plan/interfaces/ReportingPlan.md)

## Returns

[`Evaluation`](../interfaces/Evaluation.md)

## Throws

RangeError when the plan names something it does not define, a
  dataset is missing, or a denominator cannot be found.
