[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/amendments](../README.md) / tickAmendmentEffects

# Function: tickAmendmentEffects()

> **tickAmendmentEffects**(`state`, `deltaSeconds`): `object`

Advances the spot inspection window.

## Parameters

### state

[`AmendmentEffectsState`](../interfaces/AmendmentEffectsState.md)

The effects in force.

### deltaSeconds

`number`

Seconds to advance; 0 while clocks are held.

## Returns

`object`

The new effects and whether the inspection ended this frame.

### inspectionEnded

> **inspectionEnded**: [`SpotInspection`](../interfaces/SpotInspection.md) \| `null`

### state

> **state**: [`AmendmentEffectsState`](../interfaces/AmendmentEffectsState.md)
