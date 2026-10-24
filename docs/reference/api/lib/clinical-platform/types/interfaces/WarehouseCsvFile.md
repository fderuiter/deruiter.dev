[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / WarehouseCsvFile

# Interface: WarehouseCsvFile

One CSV file of a warehouse export.

## Properties

### path

> `readonly` **path**: `string`

Relative path, for example `gold/dim_site.csv`.

***

### rowCount

> `readonly` **rowCount**: `number`

Number of data rows, header excluded.

***

### table

> `readonly` **table**: `string`

Qualified table name.

***

### text

> `readonly` **text**: `string`

CSV text: a header row, RFC 4180 quoting, LF line ends; `null` is an empty unquoted field.
