[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/silver](../README.md) / conformBronze

# Function: conformBronze()

> **conformBronze**(`portfolio`, `staff?`): [`SilverTables`](../type-aliases/SilverTables.md)

Conforms every bronze feed of a portfolio to its silver columns. The rows
are not yet de-duplicated: the caller keeps one row per primary key with
`dedupe`, reading the key from the schema.

## Parameters

### portfolio

[`Portfolio`](../../../../types/interfaces/Portfolio.md)

The portfolio, from `generatePortfolio`.

### staff?

readonly [`SiteStaffAssignment`](../../../../types/interfaces/SiteStaffAssignment.md)[] = `...`

Site staff assignments; defaults to `siteStaffFeed(portfolio)`.

## Returns

[`SilverTables`](../type-aliases/SilverTables.md)

Conformed rows per silver table.
