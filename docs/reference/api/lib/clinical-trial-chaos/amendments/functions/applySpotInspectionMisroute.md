[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/amendments](../README.md) / applySpotInspectionMisroute

# Function: applySpotInspectionMisroute()

> **applySpotInspectionMisroute**(`state`, `stationId`, `baseDelta`): `object`

Applies the spot inspection to a misroute. A misroute to the watched
station counts `SPOT_INSPECTION_SUSPICION_MULTIPLIER` times toward
suspicion and is tallied for the report; any other misroute is unchanged.

## Parameters

### state

[`AmendmentEffectsState`](../interfaces/AmendmentEffectsState.md)

The effects in force.

### stationId

[`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)

The station the CRF was wrongly routed to.

### baseDelta

`number`

Suspicion the misroute adds on its own.

## Returns

`object`

The new effects, the suspicion to add, and whether it doubled.

### doubled

> **doubled**: `boolean`

### state

> **state**: [`AmendmentEffectsState`](../interfaces/AmendmentEffectsState.md)

### suspicionDelta

> **suspicionDelta**: `number`
