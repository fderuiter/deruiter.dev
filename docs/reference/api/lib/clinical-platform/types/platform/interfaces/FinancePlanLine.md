[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / FinancePlanLine

# Interface: FinancePlanLine

One quarter of a study's approved budget plan for one cost category, from
the study's start to its planned final report. Unlike a `FinanceLine` it
covers quarters still to come, so it gives the budget at completion.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### budgetUsd

> `readonly` **budgetUsd**: `number`

Planned budget, whole US dollars.

***

### category

> `readonly` **category**: `string`

Cost category.

***

### period

> `readonly` **period**: `string`

Calendar quarter, for example `2027-Q1`.

***

### source

> `readonly` **source**: [`SourceSystem`](../type-aliases/SourceSystem.md)

Source system the record was received from.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`source`](BronzeRecord.md#source)

***

### studyId

> `readonly` **studyId**: `string`

Study id.

***

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`synthetic`](BronzeRecord.md#synthetic)

***

### vendorId

> `readonly` **vendorId**: `string` \| `null`

Vendor id, or `null` for investigator grants paid to sites.
