[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/visit-window](../README.md) / formatVisitWindow

# Function: formatVisitWindow()

> **formatVisitWindow**(`visit`): `string`

Describes the allowed days before and after a visit's target day.
A symmetric window uses the compact ± notation; an asymmetric window
states both sides so a one-sided window cannot imply extra visit days.

## Parameters

### visit

`Pick`\<[`StudyVisit`](../../types/interfaces/StudyVisit.md), `"windowBefore"` \| `"windowAfter"`\>

## Returns

`string`
