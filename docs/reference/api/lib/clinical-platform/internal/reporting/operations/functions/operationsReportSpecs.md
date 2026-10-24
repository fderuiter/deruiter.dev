[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/operations](../README.md) / operationsReportSpecs

# Function: operationsReportSpecs()

> **operationsReportSpecs**(`warehouse`, `scope?`): [`ReportSpec`](../../../../types/interfaces/ReportSpec.md)[]

Every report spec the dashboard shows at a scope, the glance first, then
each section's in order. Every one passes `checkReportSpec`.

## Parameters

### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

The warehouse the scope is read against.

### scope?

[`OperationsScope`](../../../../types/interfaces/OperationsScope.md) = `{}`

Where the dashboard is drilled to; an invalid scope is cut
  back as `operationsDashboard` does.

## Returns

[`ReportSpec`](../../../../types/interfaces/ReportSpec.md)[]

The specs.
