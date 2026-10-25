[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/warehouse](../README.md) / WarehouseExport

# Interface: WarehouseExport

CSV files and their manifest for one warehouse.

## Properties

### files

> `readonly` **files**: readonly [`WarehouseCsvFile`](WarehouseCsvFile.md)[]

One CSV file per table, in schema order.

***

### manifest

> `readonly` **manifest**: [`WarehouseExportManifest`](WarehouseExportManifest.md)

Column and type manifest.
