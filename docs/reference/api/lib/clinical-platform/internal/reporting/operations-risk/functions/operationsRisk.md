[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/operations-risk](../README.md) / operationsRisk

# Function: operationsRisk()

> **operationsRisk**(`warehouse`, `studyId`, `scopeSites`): [`OperationsRisk`](../../../../types/reporting/interfaces/OperationsRisk.md)

The Risk tab for a study, narrowed to some of its sites.

## Parameters

### warehouse

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

The warehouse the dashboard reads.

### studyId

`string`

The study drilled into.

### scopeSites

`ReadonlyMap`\<`string`, `string`\>

The study's sites in scope, each with its country
  code: all of them at the study level, a country's or one site's below
  it.

## Returns

[`OperationsRisk`](../../../../types/reporting/interfaces/OperationsRisk.md)

The tab's content.
