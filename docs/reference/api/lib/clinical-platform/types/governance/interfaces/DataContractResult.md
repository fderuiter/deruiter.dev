[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/governance](../README.md) / DataContractResult

# Interface: DataContractResult

The outcome of checking one data product against its contract.

## Properties

### ageHours

> `readonly` **ageHours**: `number`

Hours from the latest load to the check.

***

### available

> `readonly` **available**: `boolean`

Whether every object was published.

***

### completeness

> `readonly` **completeness**: `number`

Share of required values present, from 0 to 1; 1 when nothing is required.

***

### findings

> `readonly` **findings**: readonly [`DataContractFinding`](DataContractFinding.md)[]

Every broken rule; empty when the product meets its contract.

***

### passed

> `readonly` **passed**: `boolean`

Whether the product meets its contract.

***

### productId

> `readonly` **productId**: `string`

Product id.

***

### rowCount

> `readonly` **rowCount**: `number`

Rows checked, across every object.

***

### version

> `readonly` **version**: `string`

Contract version checked against.
