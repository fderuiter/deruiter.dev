[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / PortfolioSignal

# Interface: PortfolioSignal

A pattern the generator planted on purpose, so dashboards, RBQM and tests
can check that it is found. The answer key, not an input to any metric.

## Extends

- [`SyntheticRecord`](SyntheticRecord.md)

## Properties

### description

> `readonly` **description**: `string`

What was planted, in one sentence.

***

### kind

> `readonly` **kind**: [`PortfolioSignalKind`](../type-aliases/PortfolioSignalKind.md)

Signal kind.

***

### siteId

> `readonly` **siteId**: `string` \| `null`

Site, for site-level signals; otherwise `null`.

***

### studyId

> `readonly` **studyId**: `string` \| `null`

Study the signal is in, or `null` for a vendor-wide signal.

***

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`SyntheticRecord`](SyntheticRecord.md).[`synthetic`](SyntheticRecord.md#synthetic)

***

### vendorId

> `readonly` **vendorId**: `string` \| `null`

Vendor, for vendor signals; otherwise `null`.
