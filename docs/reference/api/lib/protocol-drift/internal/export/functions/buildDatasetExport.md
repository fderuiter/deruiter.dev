[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/export](../README.md) / buildDatasetExport

# Function: buildDatasetExport()

> **buildDatasetExport**(`input`): [`DatasetExportBundle`](../../../types/interfaces/DatasetExportBundle.md)

Builds the export bundle from current records.

## Parameters

### input

#### adam

readonly [`ADaMVitalSignRecord`](../../../types/interfaces/ADaMVitalSignRecord.md)[]

#### audit

readonly [`AuditTrailEvent`](../../../types/interfaces/AuditTrailEvent.md)[]

#### mh

readonly [`SDTMMedicalHistoryRecord`](../../../types/interfaces/SDTMMedicalHistoryRecord.md)[]

#### unpaired

readonly [`ADaMVitalSignRecord`](../../../types/interfaces/ADaMVitalSignRecord.md)[]

#### vs

readonly [`SDTMVitalSignRecord`](../../../types/interfaces/SDTMVitalSignRecord.md)[]

## Returns

[`DatasetExportBundle`](../../../types/interfaces/DatasetExportBundle.md)
