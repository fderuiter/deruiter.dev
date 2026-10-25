[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/operations](../README.md) / operationsDashboard

# Function: operationsDashboard()

> **operationsDashboard**(`warehouse`, `scope?`): [`OperationsDashboard`](../../../../types/reporting/interfaces/OperationsDashboard.md)

The operations dashboard at a scope: the glance, one section per tab
with its reports and gaps, the breadcrumb trail, the studies, countries
or sites to drill into next, and below the portfolio level the study's
risk-based quality management narrowed to the scope.

## Parameters

### warehouse

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

The warehouse to report on.

### scope?

[`OperationsScope`](../../../../types/reporting/interfaces/OperationsScope.md) = `{}`

Where the dashboard is drilled to. An unknown study,
  country or site is dropped, with a notice saying so.

## Returns

[`OperationsDashboard`](../../../../types/reporting/interfaces/OperationsDashboard.md)

The dashboard.
