[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/milestones](../README.md) / studyMilestones

# Function: studyMilestones()

> **studyMilestones**(`warehouse`, `studyKey`): ([`OperationsMilestone`](../../../../types/reporting/interfaces/OperationsMilestone.md) & `object`)[]

The milestones of one study, in milestone order.

## Parameters

### warehouse

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

The warehouse.

### studyKey

`unknown`

The study's `study_key` in `gold.dim_study`.

## Returns

([`OperationsMilestone`](../../../../types/reporting/interfaces/OperationsMilestone.md) & `object`)[]

Each milestone with its kind, the study's own label, and its planned and actual dates.
