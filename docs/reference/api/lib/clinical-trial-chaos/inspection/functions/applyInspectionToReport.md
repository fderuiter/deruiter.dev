[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/inspection](../README.md) / applyInspectionToReport

# Function: applyInspectionToReport()

> **applyInspectionToReport**(`report`, `round`): [`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

Adds the record questions of the inspection interview to a report: each
miss is a Minor finding, and `INSPECTION_INCOMPLETE_TRAIL_MISSES` misses
add a Major "audit trail incomplete" finding. Skeleton questions are applied by
`applySponsorSkeletonsToReport`.

## Parameters

### report

[`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

The report, sponsor skeletons already applied.

### round

[`InspectionRound`](../interfaces/InspectionRound.md)

The finished round.

## Returns

[`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

The report with the interview applied.
