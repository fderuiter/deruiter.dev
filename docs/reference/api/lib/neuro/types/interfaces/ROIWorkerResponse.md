[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/neuro/types](../README.md) / ROIWorkerResponse

# Interface: ROIWorkerResponse

## Properties

### contours?

> `optional` **contours?**: [`VectorContourPath`](VectorContourPath.md)[]

***

### error?

> `optional` **error?**: `string`

***

### histogram?

> `optional` **histogram?**: [`HistogramStats`](HistogramStats.md)

***

### id

> **id**: `string`

***

### qaAlerts?

> `optional` **qaAlerts?**: [`QAAnomalyAlert`](QAAnomalyAlert.md)[]

***

### roiMask?

> `optional` **roiMask?**: `Uint8Array`\<`ArrayBufferLike`\>

***

### scanDurationMs?

> `optional` **scanDurationMs?**: `number`

***

### segmentation?

> `optional` **segmentation?**: [`ROISegmentationResult`](ROISegmentationResult.md)

***

### seq

> **seq**: `number`

***

### success

> **success**: `boolean`

***

### type

> **type**: `"region_grow"` \| `"marching_squares"` \| `"histogram"` \| `"qa_scan"`
