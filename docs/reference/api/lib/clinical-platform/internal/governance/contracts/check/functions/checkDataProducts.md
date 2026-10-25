[**fderuiter-portfolio**](../../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../../modules.md) / [lib/clinical-platform/internal/governance/contracts/check](../README.md) / checkDataProducts

# Function: checkDataProducts()

> **checkDataProducts**(`products`, `contracts`): [`DataContractFinding`](../../../../../types/governance/interfaces/DataContractFinding.md)[]

Checks the product registry: every warehouse table and the study data
are registered and nothing else is; each product has an owner and a
steward; each contract has a semantic version, service levels in range,
a retention period with its basis, and objects with unique column names
and a primary key made of required, declared columns.

## Parameters

### products

readonly [`DataProduct`](../../../../../types/platform/interfaces/DataProduct.md)[]

Products, from `dataProducts`.

### contracts

readonly [`DataContract`](../../../../../types/platform/interfaces/DataContract.md)[]

Their contracts, from `dataContracts`.

## Returns

[`DataContractFinding`](../../../../../types/governance/interfaces/DataContractFinding.md)[]

Every broken rule; empty when the registry is sound.
