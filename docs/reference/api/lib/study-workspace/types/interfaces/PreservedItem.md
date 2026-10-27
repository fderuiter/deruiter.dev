[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-workspace/types](../README.md) / PreservedItem

# Interface: PreservedItem

Content the workspace keeps untouched and writes back on export.

## Properties

### label

> `readonly` **label**: `string`

A short human label, e.g. the version identifier or design name.

***

### path

> `readonly` **path**: `string`

Dotted path into the USDM document, e.g. `study.versions.1`.

***

### reason

> `readonly` **reason**: [`PreservedReason`](../type-aliases/PreservedReason.md)
