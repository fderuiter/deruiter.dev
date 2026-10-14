[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/types](../README.md) / SignatureModalState

# Interface: SignatureModalState

## Properties

### isOpen

> **isOpen**: `boolean`

***

### passwordInput

> **passwordInput**: `string`

***

### requiresReason

> **requiresReason**: `boolean`

***

### selectedReason

> **selectedReason**: [`SignatureReason`](../type-aliases/SignatureReason.md)

***

### signaturesApplied?

> `optional` **signaturesApplied?**: `number`

Signature steps already applied in this dialog.

***

### signaturesRequired?

> `optional` **signaturesRequired?**: `number`

Signature steps this CRF needs: 2 during a double-signature audit (#2053).

***

### subject

> **subject**: [`ClinicalSubject`](ClinicalSubject.md) \| `null`
