[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/analysis](../README.md) / pairMeasurements

# Function: pairMeasurements()

> **pairMeasurements**(`sitting`, `standing`): [`ADaMVitalSignRecord`](../../../types/interfaces/ADaMVitalSignRecord.md) \| [`TraceViolation`](../../../types/interfaces/TraceViolation.md)

Pairs one sitting and one standing record. Returns a TRACE violation when
they belong to different subjects, visits or tests, or the positions are
wrong; otherwise the derived ADVS row.

## Parameters

### sitting

[`SDTMVitalSignRecord`](../../../types/interfaces/SDTMVitalSignRecord.md)

### standing

[`SDTMVitalSignRecord`](../../../types/interfaces/SDTMVitalSignRecord.md)

## Returns

[`ADaMVitalSignRecord`](../../../types/interfaces/ADaMVitalSignRecord.md) \| [`TraceViolation`](../../../types/interfaces/TraceViolation.md)
