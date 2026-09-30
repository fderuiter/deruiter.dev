[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/neuro/types](../README.md) / QAAnomalyAlert

# Interface: QAAnomalyAlert

## Properties

### description

> **description**: `string`

***

### id

> **id**: `string`

***

### metricValue?

> `optional` **metricValue?**: `number`

***

### plane

> **plane**: [`SlicePlane`](../type-aliases/SlicePlane.md)

***

### severity

> **severity**: `"warning"` \| `"info"` \| `"critical"`

***

### sliceIndex

> **sliceIndex**: `number`

***

### suggestedAction

> **suggestedAction**: `string`

***

### type

> **type**: `"dura_inclusion"` \| `"skull_strip_erosion"` \| `"topological_handle"` \| `"signal_dropout"` \| `"intensity_spike"`

***

### voxelCoord

> **voxelCoord**: [`VoxelCoord`](VoxelCoord.md)
