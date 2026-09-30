[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/maintenance-service](../README.md) / MaintenancePhaseResult

# Type Alias: MaintenancePhaseResult

> **MaintenancePhaseResult** = [`ServiceResult`](../../service-result/type-aliases/ServiceResult.md)\<[`MaintenancePhaseCounts`](MaintenancePhaseCounts.md)\>

Result envelope an adapter returns for one phase. The error code is the
underlying service's code (for example `PERSISTENCE_FAILED`), so a failure
keeps the service's own taxonomy.
