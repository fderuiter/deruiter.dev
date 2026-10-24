[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/evaluate](../README.md) / ResultIndex

# Class: ResultIndex

Finds results by analysis, operation and groups.

## Constructors

### Constructor

> **new ResultIndex**(`analyses`): `ResultIndex`

#### Parameters

##### analyses

readonly [`ArsAnalysis`](../../../../types/interfaces/ArsAnalysis.md)[]

#### Returns

`ResultIndex`

## Methods

### get()

> **get**(`analysisId`, `operationId`, `groups`): [`ArsOperationResult`](../../../../types/interfaces/ArsOperationResult.md)

The result of one operation for one combination of groups.

#### Parameters

##### analysisId

`string`

##### operationId

`string`

##### groups

readonly [`ArsResultGroup`](../../../../types/interfaces/ArsResultGroup.md)[]

#### Returns

[`ArsOperationResult`](../../../../types/interfaces/ArsOperationResult.md)

#### Throws

RangeError when there is no such result.
