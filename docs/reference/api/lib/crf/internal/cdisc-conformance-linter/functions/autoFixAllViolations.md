[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/cdisc-conformance-linter](../README.md) / autoFixAllViolations

# Function: autoFixAllViolations()

> **autoFixAllViolations**(`study`): `object`

Automatically applies all available 1-Click Auto-Fix remediations across the entire study protocol.

## Parameters

### study

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

The current study protocol

## Returns

`object`

An object containing the updated study protocol and the count of fixed violations

### fixedCount

> **fixedCount**: `number`

### updatedStudy

> **updatedStudy**: [`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)
