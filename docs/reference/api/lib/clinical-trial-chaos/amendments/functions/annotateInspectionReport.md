[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/amendments](../README.md) / annotateInspectionReport

# Function: annotateInspectionReport()

> **annotateInspectionReport**(`report`, `auditYear`, `effects`): [`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

Adds the endless Audit Year and the amendment outcomes to a BIMO report.

## Parameters

### report

[`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

The report from `buildInspectionReport`.

### auditYear

`number` \| `null`

The endless Audit Year reached, or null for a campaign.

### effects

[`AmendmentEffectsState`](../interfaces/AmendmentEffectsState.md)

The amendment effects at the end of the shift.

## Returns

[`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

The annotated report.
