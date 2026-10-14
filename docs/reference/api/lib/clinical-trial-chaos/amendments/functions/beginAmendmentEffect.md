[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/amendments](../README.md) / beginAmendmentEffect

# Function: beginAmendmentEffect()

> **beginAmendmentEffect**(`state`, `amendment`, `stationIds`, `random?`): [`AmendmentEffectsState`](../interfaces/AmendmentEffectsState.md)

Starts the lasting rule an amendment brings, if it brings one. A new
double-signature audit while one is open tops the requirement back up to
`DOUBLE_SIGNATURE_CRF_COUNT` uncountersigned CRFs. A new spot inspection
closes the previous one and picks a fresh station.

## Parameters

### state

[`AmendmentEffectsState`](../interfaces/AmendmentEffectsState.md)

The effects in force.

### amendment

`Pick`\<[`ProtocolAmendment`](../../types/interfaces/ProtocolAmendment.md), `"type"` \| `"durationSeconds"`\>

The amendment that just fired.

### stationIds

readonly [`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)[]

Stations open on the floor.

### random?

() => `number`

Random source returning values in [0, 1).

## Returns

[`AmendmentEffectsState`](../interfaces/AmendmentEffectsState.md)

The effects with the new rule in force.
