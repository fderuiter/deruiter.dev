[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/inspection](../README.md) / InspectionSignature

# Interface: InspectionSignature

How a locked CRF was signed.

## Properties

### method

> **method**: `"routine"` \| `"signed"` \| `"fast-track"`

`routine`: quick dispatch, logged without an e-signature dialog.
`signed`: the signature dialog. `fast-track`: the Fast-Track lifeline.

***

### reason

> **reason**: [`SignatureReason`](../../types/type-aliases/SignatureReason.md)

***

### signatures

> **signatures**: `number`

Signatures applied: 2 under a double-signature audit.
