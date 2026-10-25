[**fderuiter-portfolio**](../../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../../modules.md) / [lib/clinical-platform/internal/governance/contracts/evolution](../README.md) / contractDifferences

# Function: contractDifferences()

> **contractDifferences**(`previous`, `next`): [`ContractDifference`](../../../../../types/governance/interfaces/ContractDifference.md)[]

Every difference between two versions of a contract, each graded by the
version bump it needs. Breaking (major): a removed table, dataset or
column; a changed type; a column that may now be null; a narrower length,
precision, scale or a new pattern; a changed primary key or physical
name; a stricter classification; and a weaker service level or a shorter
retention. Additive (minor): an added table, dataset or column; a column
that is now required; a wider limit; a looser classification; a stronger
service level or a longer retention. Anything else that changes, such as
a description or the order of columns, is a patch.

## Parameters

### previous

[`DataContract`](../../../../../types/platform/interfaces/DataContract.md)

The earlier contract.

### next

[`DataContract`](../../../../../types/platform/interfaces/DataContract.md)

The later contract.

## Returns

[`ContractDifference`](../../../../../types/governance/interfaces/ContractDifference.md)[]

The differences, in contract order; empty when the two are the same.
