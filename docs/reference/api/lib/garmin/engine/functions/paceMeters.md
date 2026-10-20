[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/engine](../README.md) / paceMeters

# Function: paceMeters()

> **paceMeters**(`state`): `number`

Metres to measure pace on: the furthest point reached this run, so a lost
life that rewinds the runner never slows the pace readout. A Training Plan
workout counts from the start of its stage (#1994).

## Parameters

### state

`Pick`\<[`GameEngineState`](../interfaces/GameEngineState.md), `"distanceMeters"` \| `"furthestMeters"` \| `"plan"`\>

## Returns

`number`
