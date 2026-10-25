[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/quality/rules](../README.md) / PlatformDqRule

# Interface: PlatformDqRule

A platform rule with its check and its fault.

## Extends

- [`DqRule`](../../../../types/interfaces/DqRule.md)

## Properties

### check

> `readonly` **check**: (`ctx`) => [`DqCheck`](../../context/interfaces/DqCheck.md)

#### Parameters

##### ctx

[`DqContext`](../../context/interfaces/DqContext.md)

#### Returns

[`DqCheck`](../../context/interfaces/DqCheck.md)

***

### citation

> `readonly` **citation**: `string` \| `null`

Published rule or guide the rule models, for ingested rules; `null` otherwise.

#### Inherited from

[`DqRule`](../../../../types/interfaces/DqRule.md).[`citation`](../../../../types/interfaces/DqRule.md#citation)

***

### dataset

> `readonly` **dataset**: `string` \| `null`

Dataset within the product, for an ingested conformance rule; `null` otherwise.

#### Inherited from

[`DqRule`](../../../../types/interfaces/DqRule.md).[`dataset`](../../../../types/interfaces/DqRule.md#dataset)

***

### dimension

> `readonly` **dimension**: [`DqDimension`](../../../../types/type-aliases/DqDimension.md)

#### Inherited from

[`DqRule`](../../../../types/interfaces/DqRule.md).[`dimension`](../../../../types/interfaces/DqRule.md#dimension)

***

### expression

> `readonly` **expression**: `string`

The check as a SQL-style predicate over the product's rows.

#### Inherited from

[`DqRule`](../../../../types/interfaces/DqRule.md).[`expression`](../../../../types/interfaces/DqRule.md#expression)

***

### fault

> `readonly` **fault**: (`warehouse`) => [`Warehouse`](../../../../types/interfaces/Warehouse.md)

#### Parameters

##### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

#### Returns

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

***

### id

> `readonly` **id**: `string`

Stable id: `DQ-` and a dimension letter for platform rules, the conformance rule id for ingested ones.

#### Inherited from

[`DqRule`](../../../../types/interfaces/DqRule.md).[`id`](../../../../types/interfaces/DqRule.md#id)

***

### name

> `readonly` **name**: `string`

What the rule asks, in a sentence.

#### Inherited from

[`DqRule`](../../../../types/interfaces/DqRule.md).[`name`](../../../../types/interfaces/DqRule.md#name)

***

### owner

> `readonly` **owner**: `string`

Data steward of the product, from its contract registration.

#### Inherited from

[`DqRule`](../../../../types/interfaces/DqRule.md).[`owner`](../../../../types/interfaces/DqRule.md#owner)

***

### productId

> `readonly` **productId**: `string`

Data product the rule checks: a warehouse table, or the Study Data Pipeline.

#### Inherited from

[`DqRule`](../../../../types/interfaces/DqRule.md).[`productId`](../../../../types/interfaces/DqRule.md#productid)

***

### rationale

> `readonly` **rationale**: `string`

Why the rule exists.

#### Inherited from

[`DqRule`](../../../../types/interfaces/DqRule.md).[`rationale`](../../../../types/interfaces/DqRule.md#rationale)

***

### severity

> `readonly` **severity**: [`DqSeverity`](../../../../types/type-aliases/DqSeverity.md)

#### Inherited from

[`DqRule`](../../../../types/interfaces/DqRule.md).[`severity`](../../../../types/interfaces/DqRule.md#severity)

***

### source

> `readonly` **source**: `"platform"` \| `"conformance"`

`platform` for rules written here, `conformance` for Study Data Pipeline rules ingested as they are.

#### Inherited from

[`DqRule`](../../../../types/interfaces/DqRule.md).[`source`](../../../../types/interfaces/DqRule.md#source)

***

### threshold

> `readonly` **threshold**: `number`

Least share of checked rows that must pass, from 0 to 1.

#### Inherited from

[`DqRule`](../../../../types/interfaces/DqRule.md).[`threshold`](../../../../types/interfaces/DqRule.md#threshold)
