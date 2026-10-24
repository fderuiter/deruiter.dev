[**fderuiter-portfolio**](../../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../../modules.md) / [lib/clinical-platform/internal/governance/contracts/derive](../README.md) / dataContracts

# Function: dataContracts()

> **dataContracts**(`run`): [`DataContract`](../../../../../types/interfaces/DataContract.md)[]

Every data contract in force: one per silver and gold table, and one for
the Study Data Pipeline's SDTM and ADaM output covering each of its
datasets. The pipeline's collected layer is its own input stage, read
into the bronze feeds, so it is not a published product.

## Parameters

### run

[`PipelineRun`](../../../../../../study-data/types/interfaces/PipelineRun.md)

A Study Data Pipeline run, which supplies the dataset
  metadata; the metadata does not depend on the seed or subject count.

## Returns

[`DataContract`](../../../../../types/interfaces/DataContract.md)[]

The contracts, warehouse tables in schema order, then the study data.
