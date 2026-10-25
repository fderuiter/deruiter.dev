[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/strategy/engine](../README.md) / planRoadmap

# Function: planRoadmap()

> **planRoadmap**(`items`, `capacity`): `object`

Ready items respect dependencies and the capacity budget in each horizon.

## Parameters

### items

readonly [`RoadmapItem`](../../../../types/strategy/interfaces/RoadmapItem.md)[]

### capacity

`number`

## Returns

`object`

### blocked

> **blocked**: [`RoadmapItem`](../../../../types/strategy/interfaces/RoadmapItem.md)[] = `remaining`

### horizons

> **horizons**: `object`[] = `result`
