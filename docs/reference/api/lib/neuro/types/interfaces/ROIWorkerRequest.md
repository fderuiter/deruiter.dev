[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/neuro/types](../README.md) / ROIWorkerRequest

# Interface: ROIWorkerRequest

## Properties

### brainmask?

> `optional` **brainmask?**: `Uint8Array`\<`ArrayBufferLike`\>

***

### dimensions?

> `optional` **dimensions?**: `object`

#### depth

> **depth**: `number`

#### height

> **height**: `number`

#### width

> **width**: `number`

***

### id

> **id**: `string`

***

### intensityTolerance?

> `optional` **intensityTolerance?**: `number`

***

### isovalue?

> `optional` **isovalue?**: `number`

***

### plane?

> `optional` **plane?**: [`SlicePlane`](../type-aliases/SlicePlane.md)

***

### rawT1?

> `optional` **rawT1?**: `Uint8Array`\<`ArrayBufferLike`\>

***

### roiMask?

> `optional` **roiMask?**: `Uint8Array`\<`ArrayBufferLike`\>

***

### scenarioId?

> `optional` **scenarioId?**: [`ScenarioId`](../type-aliases/ScenarioId.md)

***

### seed?

> `optional` **seed?**: [`VoxelCoord`](VoxelCoord.md)

***

### seq

> **seq**: `number`

***

### sliceIndex?

> `optional` **sliceIndex?**: `number`

***

### type

> **type**: `"region_grow"` \| `"marching_squares"` \| `"histogram"` \| `"qa_scan"`

***

### wmMask?

> `optional` **wmMask?**: `Uint8Array`\<`ArrayBufferLike`\>
