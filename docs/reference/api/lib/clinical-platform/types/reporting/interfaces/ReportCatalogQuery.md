[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/reporting](../README.md) / ReportCatalogQuery

# Interface: ReportCatalogQuery

A search of the report catalog. Every given criterion must match.

## Properties

### audience?

> `readonly` `optional` **audience?**: `string`

Audience kept, exactly; absent keeps every audience.

***

### text?

> `readonly` `optional` **text?**: `string`

Words matched, case-insensitively, against title, purpose, audience, owner and metric names.

***

### tiers?

> `readonly` `optional` **tiers?**: readonly [`ReportTier`](../../platform/type-aliases/ReportTier.md)[]

Tiers kept; empty or absent keeps every tier.
