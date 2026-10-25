[**fderuiter-portfolio**](../../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../../modules.md) / [lib/clinical-platform/internal/governance/contracts/derive](../README.md) / dataProducts

# Function: dataProducts()

> **dataProducts**(`run`): [`DataProduct`](../../../../../types/platform/interfaces/DataProduct.md)[]

Every data product, with its owner, steward, classification, upstream
sources and known consumers (downstream products, and the governed
metrics whose formulas read it).

## Parameters

### run

[`PipelineRun`](../../../../../../study-data/types/interfaces/PipelineRun.md)

A Study Data Pipeline run, as for `dataContracts`.

## Returns

[`DataProduct`](../../../../../types/platform/interfaces/DataProduct.md)[]

The products, in the same order as `dataContracts`.
