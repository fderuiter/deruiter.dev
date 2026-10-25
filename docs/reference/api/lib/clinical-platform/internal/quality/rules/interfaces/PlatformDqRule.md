[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/quality/rules](../README.md) / PlatformDqRule

# Interface: PlatformDqRule

A platform rule with its check and its fault.

## Extends

- [`DqRule`](../../../../types/quality/interfaces/DqRule.md)

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

[`DqRule`](../../../../types/quality/interfaces/DqRule.md).[`citation`](../../../../types/quality/interfaces/DqRule.md#citation)

***

### dataset

> `readonly` **dataset**: `string` \| `null`

Dataset within the product, for an ingested conformance rule; `null` otherwise.

#### Inherited from

[`DqRule`](../../../../types/quality/interfaces/DqRule.md).[`dataset`](../../../../types/quality/interfaces/DqRule.md#dataset)

***

### dimension

> `readonly` **dimension**: [`DqDimension`](../../../../types/platform/type-aliases/DqDimension.md)

#### Inherited from

[`DqRule`](../../../../types/quality/interfaces/DqRule.md).[`dimension`](../../../../types/quality/interfaces/DqRule.md#dimension)

***

### expression

> `readonly` **expression**: `string`

The check as a SQL-style predicate over the product's rows.

#### Inherited from

[`DqRule`](../../../../types/quality/interfaces/DqRule.md).[`expression`](../../../../types/quality/interfaces/DqRule.md#expression)

***

### fault

> `readonly` **fault**: (`warehouse`) => [`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

#### Parameters

##### warehouse

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

#### Returns

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

***

### id

> `readonly` **id**: `string`

Stable id: `DQ-` and a dimension letter for platform rules, the conformance rule id for ingested ones.

#### Inherited from

[`DqRule`](../../../../types/quality/interfaces/DqRule.md).[`id`](../../../../types/quality/interfaces/DqRule.md#id)

***

### name

> `readonly` **name**: `string`

What the rule asks, in a sentence.

#### Inherited from

[`DqRule`](../../../../types/quality/interfaces/DqRule.md).[`name`](../../../../types/quality/interfaces/DqRule.md#name)

***

### owner

> `readonly` **owner**: `string`

Data steward of the product, from its contract registration.

#### Inherited from

[`DqRule`](../../../../types/quality/interfaces/DqRule.md).[`owner`](../../../../types/quality/interfaces/DqRule.md#owner)

***

### productId

> `readonly` **productId**: `string`

Data product the rule checks: a warehouse table, or the Study Data Pipeline.

#### Inherited from

[`DqRule`](../../../../types/quality/interfaces/DqRule.md).[`productId`](../../../../types/quality/interfaces/DqRule.md#productid)

***

### rationale

> `readonly` **rationale**: `string`

Why the rule exists.

#### Inherited from

[`DqRule`](../../../../types/quality/interfaces/DqRule.md).[`rationale`](../../../../types/quality/interfaces/DqRule.md#rationale)

***

### severity

> `readonly` **severity**: [`DqSeverity`](../../../../types/quality/type-aliases/DqSeverity.md)

#### Inherited from

[`DqRule`](../../../../types/quality/interfaces/DqRule.md).[`severity`](../../../../types/quality/interfaces/DqRule.md#severity)

***

### source

> `readonly` **source**: `"platform"` \| `"conformance"`

`platform` for rules written here, `conformance` for Study Data Pipeline rules ingested as they are.

#### Inherited from

[`DqRule`](../../../../types/quality/interfaces/DqRule.md).[`source`](../../../../types/quality/interfaces/DqRule.md#source)

***

### threshold

> `readonly` **threshold**: `number`

Least share of checked rows that must pass, from 0 to 1.

#### Inherited from

[`DqRule`](../../../../types/quality/interfaces/DqRule.md).[`threshold`](../../../../types/quality/interfaces/DqRule.md#threshold)
