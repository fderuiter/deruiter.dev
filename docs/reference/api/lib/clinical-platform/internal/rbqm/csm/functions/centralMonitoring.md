[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/rbqm/csm](../README.md) / centralMonitoring

# Function: centralMonitoring()

> **centralMonitoring**(`warehouse`, `studyId`, `fdr?`): [`CsmRun`](../../../../types/rbqm/interfaces/CsmRun.md)

Runs the central statistical monitoring tests on one study's sites.

## Parameters

### warehouse

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

A warehouse from `buildWarehouse`.

### studyId

`string`

The study to monitor.

### fdr?

`number` = `CSM_DEFAULT_FDR`

False discovery rate, above 0 and below 1.

## Returns

[`CsmRun`](../../../../types/rbqm/interfaces/CsmRun.md)

Every test at every site with enough data, with what was left out and why.

## Throws

RangeError when `fdr` is outside (0, 1); Error for an unknown study.
