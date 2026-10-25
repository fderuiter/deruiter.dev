[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/rbqm/assess](../README.md) / assessStudyRisk

# Function: assessStudyRisk()

> **assessStudyRisk**(`warehouse`, `studyId`, `options?`): [`StudyRiskAssessment`](../../../../types/rbqm/interfaces/StudyRiskAssessment.md)

Assesses one study's risk at the warehouse's data cut.

## Parameters

### warehouse

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

A warehouse from `buildWarehouse`.

### studyId

`string`

The study to assess.

### options?

`fdr`, the false discovery rate for central monitoring (default 0.05).

#### fdr?

`number`

## Returns

[`StudyRiskAssessment`](../../../../types/rbqm/interfaces/StudyRiskAssessment.md)

The study's quality plan, KRIs, QTLs, central monitoring and the signals raised.

## Throws

Error for an unknown study; RangeError for an `fdr` outside (0, 1).
