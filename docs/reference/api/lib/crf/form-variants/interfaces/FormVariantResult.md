[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-variants](../README.md) / FormVariantResult

# Interface: FormVariantResult

Result of [createFormVariant](../functions/createFormVariant.md).

## Properties

### error?

> `optional` **error?**: `string`

***

### identityMap?

> `optional` **identityMap?**: `Record`\<`string`, `string`\>

Maps every source identity (form, section, field, rule, group) to its variant identity.

***

### preview

> **preview**: [`FormVariantPreview`](FormVariantPreview.md)

***

### study

> **study**: [`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

The committed study, or the unchanged input when `error` is set.

***

### undo?

> `optional` **undo?**: (`currentStudy`) => [`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

Reverts this transaction on a later study: removes the variant, prunes
any remaining assignment of it, and restores the touched visits'
original assignments.

#### Parameters

##### currentStudy

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

#### Returns

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

***

### variant?

> `optional` **variant?**: [`CRFForm`](../../types/interfaces/CRFForm.md)
