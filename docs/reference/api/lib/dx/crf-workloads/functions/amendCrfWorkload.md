[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/crf-workloads](../README.md) / amendCrfWorkload

# Function: amendCrfWorkload()

> **amendCrfWorkload**(`study`, `count`): `object`

Applies a deterministic protocol amendment, relabelling one field in each
of the first `count` forms, so a baseline comparison has a known number of
expected changes to find. Returns a new study; the input is not mutated.

## Parameters

### study

[`StudyProtocol`](../../../crf/types/interfaces/StudyProtocol.md)

### count

`number`

## Returns

`object`

### amendments

> **amendments**: [`CrfWorkloadAmendment`](../interfaces/CrfWorkloadAmendment.md)[]

### study

> **study**: [`StudyProtocol`](../../../crf/types/interfaces/StudyProtocol.md)
