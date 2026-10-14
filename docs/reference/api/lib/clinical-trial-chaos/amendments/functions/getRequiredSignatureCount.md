[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/amendments](../README.md) / getRequiredSignatureCount

# Function: getRequiredSignatureCount()

> **getRequiredSignatureCount**(`state`): `1` \| `2`

Signature steps the next CRF needs: two while a double-signature audit is
open, otherwise one.

## Parameters

### state

[`AmendmentEffectsState`](../interfaces/AmendmentEffectsState.md)

The effects in force.

## Returns

`1` \| `2`

1 or 2.
