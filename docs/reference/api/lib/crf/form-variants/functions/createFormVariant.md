[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-variants](../README.md) / createFormVariant

# Function: createFormVariant()

> **createFormVariant**(`study`, `sourceFormId`, `options`): [`FormVariantResult`](../interfaces/FormVariantResult.md)

Creates an explicit variant of a shared form and reassigns the selected
uses to it, as one atomic transaction: either the variant is added and
every selected use moves, or the input study is returned unchanged with
an `error`. Unselected uses keep the shared form, including arms that
followed a changed visit default, which receive an arm-specific
assignment that keeps them on the source.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### sourceFormId

`string`

### options

[`FormVariantOptions`](../interfaces/FormVariantOptions.md)

## Returns

[`FormVariantResult`](../interfaces/FormVariantResult.md)
