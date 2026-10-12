[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/engine](../README.md) / getSignatureReasonError

# Function: getSignatureReasonError()

> **getSignatureReasonError**(`subject`, `reason`): `string` \| `null`

Why a signature reason does not fit a subject, or null when it does. An
SAE subject must be signed "Urgent Safety Expedited", and that reason is
only for SAE subjects, so Sign is a real choice (#1937).

## Parameters

### subject

`Pick`\<[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md), `"isSAE"`\>

The subject being signed.

### reason

[`SignatureReason`](../../types/type-aliases/SignatureReason.md)

The chosen signature reason.

## Returns

`string` \| `null`
