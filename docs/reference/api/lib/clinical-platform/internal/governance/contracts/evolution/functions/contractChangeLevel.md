[**fderuiter-portfolio**](../../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../../modules.md) / [lib/clinical-platform/internal/governance/contracts/evolution](../README.md) / contractChangeLevel

# Function: contractChangeLevel()

> **contractChangeLevel**(`previous`, `next`): [`ContractChangeLevel`](../../../../../types/governance/type-aliases/ContractChangeLevel.md)

The version bump a contract change needs: the largest of its differences.

## Parameters

### previous

[`DataContract`](../../../../../types/platform/interfaces/DataContract.md)

The earlier contract.

### next

[`DataContract`](../../../../../types/platform/interfaces/DataContract.md)

The later contract.

## Returns

[`ContractChangeLevel`](../../../../../types/governance/type-aliases/ContractChangeLevel.md)

`none` when nothing changed.
