[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/km-evaluate](../README.md) / evaluateTimeToEvent

# Function: evaluateTimeToEvent()

> **evaluateTimeToEvent**(`input`): [`ArsOperationResult`](../../../../types/interfaces/ArsOperationResult.md)[]

The results of one time-to-event analysis.

## Parameters

### input

[`TimeToEventInput`](../interfaces/TimeToEventInput.md)

## Returns

[`ArsOperationResult`](../../../../types/interfaces/ArsOperationResult.md)[]

## Throws

RangeError when the method is not a time-to-event method or the
  analysis does not group by a pre-specified treatment factor (and, for
  the estimate, a data-driven time factor after it).
