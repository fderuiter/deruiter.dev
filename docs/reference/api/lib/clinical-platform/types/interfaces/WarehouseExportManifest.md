[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / WarehouseExportManifest

# Interface: WarehouseExportManifest

The column and type manifest shipped next to the CSV files.

## Properties

### asOf

> `readonly` **asOf**: `string`

ISO 8601 data cut.

***

### notice

> `readonly` **notice**: `string`

Synthetic data notice.

***

### portfolioId

> `readonly` **portfolioId**: `string`

Portfolio id.

***

### schemaVersion

> `readonly` **schemaVersion**: `string`

Warehouse schema version.

***

### tables

> `readonly` **tables**: readonly [`WarehouseManifestTable`](WarehouseManifestTable.md)[]

One entry per CSV file, in schema order.
