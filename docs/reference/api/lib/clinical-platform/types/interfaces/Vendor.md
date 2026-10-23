[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / Vendor

# Interface: Vendor

A fictional vendor: CRO, EDC, IRT, CTMS, eTMF or central lab provider.

## Extends

- [`SyntheticRecord`](SyntheticRecord.md)

## Properties

### id

> `readonly` **id**: `string`

Stable vendor id.

***

### name

> `readonly` **name**: `string`

Fictional name. Never the name of a real company.

***

### service

> `readonly` **service**: `"EDC"` \| `"CTMS"` \| `"IRT"` \| `"eTMF"` \| `"CRO"` \| `"Central lab"`

Service the vendor provides.

***

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`SyntheticRecord`](SyntheticRecord.md).[`synthetic`](SyntheticRecord.md#synthetic)
