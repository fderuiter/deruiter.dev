[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/neuro/roi-analytics](../README.md) / requestROISegmentationAsync

# Function: requestROISegmentationAsync()

> **requestROISegmentationAsync**(`rawT1`, `brainmask`, `dimensions`, `seed`, `intensityTolerance?`): `Promise`\<[`ROISegmentationResult`](../../types/interfaces/ROISegmentationResult.md)\>

Perform 3D automated region growing segmentation asynchronously via worker with zero-copy transfer.

## Parameters

### rawT1

`Uint8Array`

### brainmask

`Uint8Array`

### dimensions

#### depth

`number`

#### height

`number`

#### width

`number`

### seed

[`VoxelCoord`](../../types/interfaces/VoxelCoord.md)

### intensityTolerance?

`number` = `15`

## Returns

`Promise`\<[`ROISegmentationResult`](../../types/interfaces/ROISegmentationResult.md)\>
