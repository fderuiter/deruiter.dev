[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/governance/catalog](../README.md) / searchDataCatalog

# Function: searchDataCatalog()

> **searchDataCatalog**(`entries`, `query`, `domains?`): [`DataCatalogEntry`](../../../../types/type-aliases/DataCatalogEntry.md)[]

Searches the data catalog. Every word of `text` must appear in the
entry's id, name, description, owner, steward or stewardship domain, or,
for a product, its source domain, layer or classification, or, for a
metric, its unit or glossary term, ignoring case. Each facet that is set
must include the entry's value; a facet that applies only to products
leaves metrics out, and the metric status facet leaves products out.

## Parameters

### entries

readonly [`DataCatalogEntry`](../../../../types/type-aliases/DataCatalogEntry.md)[]

Entries from `dataCatalog`.

### query

[`DataCatalogQuery`](../../../../types/interfaces/DataCatalogQuery.md)

The search.

### domains?

readonly [`GovernanceDomain`](../../../../types/interfaces/GovernanceDomain.md)[] = `GOVERNANCE_DOMAINS`

Stewardship domains, for their names; defaults to `GOVERNANCE_DOMAINS`.

## Returns

[`DataCatalogEntry`](../../../../types/type-aliases/DataCatalogEntry.md)[]

The matching entries, in their catalog order.
