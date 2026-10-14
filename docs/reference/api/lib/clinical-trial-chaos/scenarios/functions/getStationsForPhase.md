[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/scenarios](../README.md) / getStationsForPhase

# Function: getStationsForPhase()

> **getStationsForPhase**(`phase`, `mode?`, `auditYear?`): [`StationConfig`](../../types/interfaces/StationConfig.md)[]

Stations open for a phase. Endless mode opens six and adds one with each
station step of the Audit Year rotation, up to all eight (#2053).

## Parameters

### phase

[`GamePhase`](../../types/type-aliases/GamePhase.md)

### mode?

[`GameMode`](../../types/type-aliases/GameMode.md) = `"campaign"`

### auditYear?

`number` = `1`

## Returns

[`StationConfig`](../../types/interfaces/StationConfig.md)[]
