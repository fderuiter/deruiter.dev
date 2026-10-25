[**fderuiter-portfolio**](../../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../../modules.md) / [lib/clinical-platform/internal/governance/contracts/check](../README.md) / checkDataContracts

# Function: checkDataContracts()

> **checkDataContracts**(`contracts`, `data`, `options`): [`DataContractResult`](../../../../../types/governance/interfaces/DataContractResult.md)[]

Checks every product's data against its contract.

## Parameters

### contracts

readonly [`DataContract`](../../../../../types/platform/interfaces/DataContract.md)[]

Contracts in force, from `dataContracts`.

### data

`Readonly`\<`Record`\<`string`, `Readonly`\<`Record`\<`string`, [`ContractObjectRows`](../../../../../types/governance/interfaces/ContractObjectRows.md)\>\>\>\>

Rows by product id, from `contractData`.

### options

[`ContractCheckOptions`](../../../../../types/governance/interfaces/ContractCheckOptions.md)

When the products were loaded and when they are read.

## Returns

[`DataContractResult`](../../../../../types/governance/interfaces/DataContractResult.md)[]

One result per contract, in contract order.
