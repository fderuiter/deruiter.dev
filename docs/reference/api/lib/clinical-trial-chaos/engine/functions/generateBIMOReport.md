[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/engine](../README.md) / generateBIMOReport

# Function: generateBIMOReport()

> **generateBIMOReport**(`scoreState`, `auditorState`, `_logs?`, `ruleViolations?`, `activeProtocol?`, `now?`): [`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

Generates an FDA Bioresearch Monitoring (BIMO) inspection compliance report.

## Parameters

### scoreState

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

### auditorState

[`AuditorState`](../../types/interfaces/AuditorState.md)

### \_logs?

[`AuditLogEntry`](../../types/interfaces/AuditLogEntry.md)[]

### ruleViolations?

[`RecordedRuleViolation`](../../types/interfaces/RecordedRuleViolation.md)[]

### activeProtocol?

[`StudyProtocol`](../../../crf/types/interfaces/StudyProtocol.md) \| `null`

### now?

`Date` = `...`

When the inspection is filed; it sets the run id and the audit
  date, so passing a fixed date makes the report repeatable (#2089).

## Returns

[`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)
