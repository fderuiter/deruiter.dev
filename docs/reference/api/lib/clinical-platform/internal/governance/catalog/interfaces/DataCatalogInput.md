[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/governance/catalog](../README.md) / DataCatalogInput

# Interface: DataCatalogInput

What the data catalog is built from.

## Properties

### contractResults?

> `readonly` `optional` **contractResults?**: readonly [`DataContractResult`](../../../../types/interfaces/DataContractResult.md)[]

Results of `checkDataContracts`; without them every product is `unchecked`.

***

### contracts

> `readonly` **contracts**: readonly [`DataContract`](../../../../types/interfaces/DataContract.md)[]

Their contracts, from `dataContracts`.

***

### domains?

> `readonly` `optional` **domains?**: readonly [`GovernanceDomain`](../../../../types/interfaces/GovernanceDomain.md)[]

Stewardship domains; defaults to `GOVERNANCE_DOMAINS`.

***

### lineage?

> `readonly` `optional` **lineage?**: [`PlatformLineage`](../../../../types/interfaces/PlatformLineage.md)

The lineage graph; without one no entry links into it.

***

### metrics?

> `readonly` `optional` **metrics?**: readonly [`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)[]

The registry; defaults to `METRIC_REGISTRY`.

***

### products

> `readonly` **products**: readonly [`DataProduct`](../../../../types/interfaces/DataProduct.md)[]

Products, from `dataProducts`.

***

### quality?

> `readonly` `optional` **quality?**: [`DqAssessment`](../../../../types/interfaces/DqAssessment.md)

A data quality assessment; without one no product has a score.

***

### reports?

> `readonly` `optional` **reports?**: readonly [`ReportSpec`](../../../../types/interfaces/ReportSpec.md)[]

Reports whose metrics to record; without them no metric lists a report.
