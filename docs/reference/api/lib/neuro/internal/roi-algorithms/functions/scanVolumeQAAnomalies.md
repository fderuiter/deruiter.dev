[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/neuro/internal/roi-algorithms](../README.md) / scanVolumeQAAnomalies

# Function: scanVolumeQAAnomalies()

> **scanVolumeQAAnomalies**(`volume`): `object`

Continuous full-volume QA anomaly scan covering all 96 slices in under 50 ms.

## Parameters

### volume

#### brainmask

`Uint8Array`

#### defectRegion?

\{ `max`: [`VoxelCoord`](../../../types/interfaces/VoxelCoord.md); `min`: [`VoxelCoord`](../../../types/interfaces/VoxelCoord.md); \}

#### defectRegion.max

[`VoxelCoord`](../../../types/interfaces/VoxelCoord.md)

#### defectRegion.min

[`VoxelCoord`](../../../types/interfaces/VoxelCoord.md)

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

`string`

#### wmMask

`Uint8Array`

## Returns

`object`

### alerts

> **alerts**: [`QAAnomalyAlert`](../../../types/interfaces/QAAnomalyAlert.md)[]

### scanDurationMs

> **scanDurationMs**: `number`
