[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / DataContractFinding

# Interface: DataContractFinding

A broken data product or contract rule.

## Properties

### message

> `readonly` **message**: `string`

What is wrong, in one sentence.

***

### object

> `readonly` **object**: `string` \| `null`

Object the finding is about, or `null` for the whole product.

***

### productId

> `readonly` **productId**: `string`

Product id.

***

### rule

> `readonly` **rule**: `"schema"` \| `"completeness"` \| `"registry"` \| `"freshness"` \| `"availability"` \| `"version"`

Rule that failed.
