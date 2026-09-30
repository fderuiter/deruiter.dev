[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/neuro/internal/roi-algorithms](../README.md) / runRegionGrowing

# Function: runRegionGrowing()

> **runRegionGrowing**(`rawT1`, `brainmask`, `dimensions`, `seed`, `intensityTolerance?`): [`ROISegmentationResult`](../../../types/interfaces/ROISegmentationResult.md)

Execute 3D region-growing segmentation starting from a seed voxel.

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

[`VoxelCoord`](../../../types/interfaces/VoxelCoord.md)

### intensityTolerance?

`number` = `15`

## Returns

[`ROISegmentationResult`](../../../types/interfaces/ROISegmentationResult.md)
