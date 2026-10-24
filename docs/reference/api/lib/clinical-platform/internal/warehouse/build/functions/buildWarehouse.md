[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/build](../README.md) / buildWarehouse

# Function: buildWarehouse()

> **buildWarehouse**(`portfolio`, `options?`): [`Warehouse`](../../../../types/interfaces/Warehouse.md)

Builds the silver and gold layers of a portfolio. Silver conforms each
bronze feed and keeps one row per primary key; gold is a star schema of
conformed dimensions and facts at a declared grain, with SCD type 2 on
`dim_site`. The output is a pure function of the portfolio: no clock,
locale or random input.

## Parameters

### portfolio

[`Portfolio`](../../../../types/interfaces/Portfolio.md)

The portfolio, from `generatePortfolio`.

### options?

[`WarehouseOptions`](../interfaces/WarehouseOptions.md) = `{}`

Optional site staff override.

## Returns

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

Rows per qualified table name, in `WAREHOUSE_SCHEMA` order.

## Throws

Error when a fact has no site version on its date, which would mean
the portfolio broke its own date invariants.
