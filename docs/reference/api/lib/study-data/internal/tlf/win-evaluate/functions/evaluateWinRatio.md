[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/win-evaluate](../README.md) / evaluateWinRatio

# Function: evaluateWinRatio()

> **evaluateWinRatio**(`input`): [`ArsOperationResult`](../../../../types/interfaces/ArsOperationResult.md)[]

The results of one win-ratio analysis.

## Parameters

### input

[`WinRatioInput`](../interfaces/WinRatioInput.md)

## Returns

[`ArsOperationResult`](../../../../types/interfaces/ArsOperationResult.md)[]

## Throws

RangeError when the analysis has no comparison, the comparison
  names a group its treatment grouping lacks, or the method is not a
  win-ratio method.
