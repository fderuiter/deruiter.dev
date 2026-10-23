[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / FinanceLine

# Interface: FinanceLine

Finance line: budget against actual for one study, vendor and quarter.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### actualUsd

> `readonly` **actualUsd**: `number`

Actual spend, whole US dollars.

***

### budgetUsd

> `readonly` **budgetUsd**: `number`

Budgeted amount, whole US dollars.

***

### category

> `readonly` **category**: `string`

Cost category.

***

### period

> `readonly` **period**: `string`

Calendar quarter, for example `2026-Q3`.

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
