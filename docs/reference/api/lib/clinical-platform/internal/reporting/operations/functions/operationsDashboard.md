[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/operations](../README.md) / operationsDashboard

# Function: operationsDashboard()

> **operationsDashboard**(`warehouse`, `scope?`): [`OperationsDashboard`](../../../../types/interfaces/OperationsDashboard.md)

The operations dashboard at a scope: the glance, one section per tab
with its reports and gaps, the breadcrumb trail, and the studies,
countries or sites to drill into next.

## Parameters

### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

The warehouse to report on.

### scope?

[`OperationsScope`](../../../../types/interfaces/OperationsScope.md) = `{}`

Where the dashboard is drilled to. An unknown study,
  country or site is dropped, with a notice saying so.

## Returns

[`OperationsDashboard`](../../../../types/interfaces/OperationsDashboard.md)

The dashboard.
