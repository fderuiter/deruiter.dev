[**fderuiter-portfolio**](../../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../../modules.md) / [lib/clinical-platform/internal/governance/contracts/check](../README.md) / checkDataContract

# Function: checkDataContract()

> **checkDataContract**(`contract`, `data`, `options`): [`DataContractResult`](../../../../../types/interfaces/DataContractResult.md)

Checks one product's data against its contract. Schema conformance comes
first: every contract column is present and no other column is, every
non-null value fits its column's type, length and pattern, and the
primary key identifies each row. Then each service level: required values
present at least at the completeness target, the latest load no older
than the freshness target, and every object published.

## Parameters

### contract

[`DataContract`](../../../../../types/interfaces/DataContract.md)

The contract in force.

### data

`Readonly`\<`Record`\<`string`, [`ContractObjectRows`](../../../../../types/interfaces/ContractObjectRows.md) \| `undefined`\>\>

The product's rows, by contract object name.

### options

[`ContractCheckOptions`](../../../../../types/interfaces/ContractCheckOptions.md)

When the product was loaded and when it is read.

## Returns

[`DataContractResult`](../../../../../types/interfaces/DataContractResult.md)

The result, with every broken rule.

## Throws

RangeError when a timestamp is not ISO 8601, or the check runs before the load.
