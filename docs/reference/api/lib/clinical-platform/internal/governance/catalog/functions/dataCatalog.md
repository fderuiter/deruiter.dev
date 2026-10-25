[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/governance/catalog](../README.md) / dataCatalog

# Function: dataCatalog()

> **dataCatalog**(`input`): [`DataCatalogEntry`](../../../../types/governance/type-aliases/DataCatalogEntry.md)[]

The data catalog: every data product in the order given, then every
metric in registry order.

## Parameters

### input

[`DataCatalogInput`](../interfaces/DataCatalogInput.md)

Products, contracts and what the catalog shows of them.

## Returns

[`DataCatalogEntry`](../../../../types/governance/type-aliases/DataCatalogEntry.md)[]

One entry per product and per metric.

## Throws

Error when a product has no contract, or an owner or steward is
  in no stewardship domain.
