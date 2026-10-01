[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/neuro/roi-analytics](../README.md) / requestVolumeQAScanAsync

# Function: requestVolumeQAScanAsync()

> **requestVolumeQAScanAsync**(`volume`): `Promise`\<\{ `alerts`: [`QAAnomalyAlert`](../../types/interfaces/QAAnomalyAlert.md)[]; `scanDurationMs`: `number`; \}\>

Perform continuous full-volume QA anomaly scan asynchronously via worker.

## Parameters

### volume

#### brainmask

`Uint8Array`

#### defectRegion?

\{ `max`: [`VoxelCoord`](../../types/interfaces/VoxelCoord.md); `min`: [`VoxelCoord`](../../types/interfaces/VoxelCoord.md); \}

#### defectRegion.max

[`VoxelCoord`](../../types/interfaces/VoxelCoord.md)

#### defectRegion.min

[`VoxelCoord`](../../types/interfaces/VoxelCoord.md)

#### dimensions

\{ `depth`: `number`; `height`: `number`; `width`: `number`; \}

#### dimensions.depth

`number`

#### dimensions.height

`number`

#### dimensions.width

`number`

#### rawT1

`Uint8Array`

#### scenarioId?

[`ScenarioId`](../../types/type-aliases/ScenarioId.md)

#### wmMask

`Uint8Array`

## Returns

`Promise`\<\{ `alerts`: [`QAAnomalyAlert`](../../types/interfaces/QAAnomalyAlert.md)[]; `scanDurationMs`: `number`; \}\>
