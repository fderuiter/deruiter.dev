[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / buildInspectionReport

# Function: buildInspectionReport()

> **buildInspectionReport**(`score`, `auditor`, `logs`, `violations`, `protocol`, `skeletons`): [`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

The BIMO inspection report shown when a phase clears or the shift ends,
with the sponsor's skeletons added as findings.

## Parameters

### score

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

Score state the report grades.

### auditor

[`AuditorState`](../../types/interfaces/AuditorState.md)

Auditor state the report grades.

### logs

[`AuditLogEntry`](../../types/interfaces/AuditLogEntry.md)[]

Audit trail.

### violations

[`RecordedRuleViolation`](../../types/interfaces/RecordedRuleViolation.md)[]

Wrong fixes recorded during the shift.

### protocol

[`StudyProtocol`](../../../crf/types/interfaces/StudyProtocol.md) \| `null`

The simulated study protocol, if any.

### skeletons

readonly [`SponsorSkeleton`](../../sponsor/interfaces/SponsorSkeleton.md)[]

Sponsor-pleasing shortcuts taken this shift.

## Returns

[`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

The inspection report.
