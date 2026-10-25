[**fderuiter-portfolio**](../../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../../modules.md) / [lib/clinical-platform/internal/governance/contracts/check](../README.md) / contractData

# Function: contractData()

> **contractData**(`warehouse`, `run`): `Record`\<`string`, `Record`\<`string`, [`ContractObjectRows`](../../../../../types/governance/interfaces/ContractObjectRows.md)\>\>

The data each contract covers: every warehouse table, and the SDTM and
ADaM datasets of a Study Data Pipeline run.

## Parameters

### warehouse

[`Warehouse`](../../../../../types/platform/interfaces/Warehouse.md)

A built warehouse.

### run

[`PipelineRun`](../../../../../../study-data/types/interfaces/PipelineRun.md)

The Study Data Pipeline run whose output the study data product publishes.

## Returns

`Record`\<`string`, `Record`\<`string`, [`ContractObjectRows`](../../../../../types/governance/interfaces/ContractObjectRows.md)\>\>

Rows by product id, then by contract object name.
