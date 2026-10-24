[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/columns](../README.md) / StorageKind

# Type Alias: StorageKind

> **StorageKind** = `"text"` \| `"number"` \| `"sas-date"` \| `"sas-datetime"` \| `"sas-time"`

How a column's values are physically stored.

- `text`: character data. SDTM `--DTC` dates stay ISO 8601 text.
- `number`: an IEEE double, `integer` and `float` variables.
- `sas-date`, `sas-datetime`, `sas-time`: ADaM timing variables, ISO 8601
  text in the pipeline, written to XPT as SAS numeric dates (days since
  1960-01-01), datetimes (seconds since 1960-01-01T00:00:00) or times
  (seconds since midnight), as ADaM analysis timing variables are.
