[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / DsqlTableParity

# Interface: DsqlTableParity

What a DSQL load must hold for one table, and how to read it back.

## Properties

### fingerprint

> `readonly` **fingerprint**: `string`

Fingerprint of the table's rows, as `fingerprintDsqlRows` computes it.

***

### readback

> `readonly` **readback**: `string`

`SELECT` returning every column as canonical text, for `fingerprintDsqlRows`.

***

### rowCount

> `readonly` **rowCount**: `number`

Rows the table holds after the load.

***

### table

> `readonly` **table**: `string`

Qualified table name.
