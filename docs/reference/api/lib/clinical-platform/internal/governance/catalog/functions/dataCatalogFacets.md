[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/governance/catalog](../README.md) / dataCatalogFacets

# Function: dataCatalogFacets()

> **dataCatalogFacets**(`entries`, `domains?`): [`DataCatalogFacets`](../../../../types/governance/interfaces/DataCatalogFacets.md)

Counts catalog entries by each facet. Every value of a facet is listed in
its defined order, including values no entry takes, so a page can show a
stable set of filters.

## Parameters

### entries

readonly [`DataCatalogEntry`](../../../../types/governance/type-aliases/DataCatalogEntry.md)[]

Entries, for example the results of a search.

### domains?

readonly [`GovernanceDomain`](../../../../types/governance/interfaces/GovernanceDomain.md)[] = `GOVERNANCE_DOMAINS`

Stewardship domains, for their order; defaults to `GOVERNANCE_DOMAINS`.

## Returns

[`DataCatalogFacets`](../../../../types/governance/interfaces/DataCatalogFacets.md)

The counts.
