[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-variants](../README.md) / FormVariantPreview

# Interface: FormVariantPreview

Previewed variant transaction, computed without changing the study.

## Properties

### changes

> **changes**: [`FormVariantUseChange`](FormVariantUseChange.md)[]

One entry per current use, in the same order as `uses`.

***

### error?

> `optional` **error?**: `string`

Set when the transaction cannot be committed as previewed.

***

### movedCount

> **movedCount**: `number`

***

### remainingCount

> **remainingCount**: `number`

***

### sourceFormId

> **sourceFormId**: `string`

***

### sourceFormName

> **sourceFormName**: `string`

***

### uses

> **uses**: [`FormUse`](FormUse.md)[]

Every current use of the source form.

***

### variantName

> **variantName**: `string`
