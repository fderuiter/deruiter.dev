[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-variants](../README.md) / FormVariantOptions

# Interface: FormVariantOptions

Options for previewing or creating a form variant.

## Properties

### actor?

> `optional` **actor?**: [`ActorContext`](../../study-engine/type-aliases/ActorContext.md)

Who performs the change, recorded on the protocol audit trail.

***

### selectedUseKeys

> **selectedUseKeys**: `string`[]

Keys of the uses to move onto the variant, from [getFormUses](../functions/getFormUses.md).

***

### variantName?

> `optional` **variantName?**: `string`

Name of the variant form. Defaults to the source name plus " (Variant)".
