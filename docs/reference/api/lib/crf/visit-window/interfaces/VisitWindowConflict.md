[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/visit-window](../README.md) / VisitWindowConflict

# Interface: VisitWindowConflict

## Properties

### earliestDayB

> **earliestDayB**: `number`

Earliest allowed day for visit B (targetDayB - windowBeforeB)

***

### latestDayA

> **latestDayA**: `number`

Latest allowed day for visit A (targetDayA + windowAfterA)

***

### message

> **message**: `string`

Human-readable explanatory message

***

### overlapDays

> **overlapDays**: `number`

Number of overlapping days between the two visit windows

***

### severity

> **severity**: `"error"` \| `"warning"`

Conflict severity: 'error' if targetDayA >= targetDayB or latestDayA > targetDayB, else 'warning'

***

### targetDayA

> **targetDayA**: `number`

Target day of visit A

***

### targetDayB

> **targetDayB**: `number`

Target day of visit B

***

### visitIdA

> **visitIdA**: `string`

ID of the earlier visit in sequence

***

### visitIdB

> **visitIdB**: `string`

ID of the later visit in sequence

***

### visitNameA

> **visitNameA**: `string`

Name of the earlier visit

***

### visitNameB

> **visitNameB**: `string`

Name of the later visit
