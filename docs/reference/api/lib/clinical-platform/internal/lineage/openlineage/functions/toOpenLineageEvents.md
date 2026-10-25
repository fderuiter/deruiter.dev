[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/lineage/openlineage](../README.md) / toOpenLineageEvents

# Function: toOpenLineageEvents()

> **toOpenLineageEvents**(`graph`, `eventTime`): [`OpenLineageRunEvent`](../../../../types/interfaces/OpenLineageRunEvent.md)[]

The lineage graph as OpenLineage run events, one per dataset the graph
computes, in stage order and then by dataset.

## Parameters

### graph

[`PlatformLineage`](../../../../types/interfaces/PlatformLineage.md)

A graph from `platformLineage`.

### eventTime

`string`

ISO 8601 date and time the runs completed, usually
  the data cut, so the events are the same on every build.

## Returns

[`OpenLineageRunEvent`](../../../../types/interfaces/OpenLineageRunEvent.md)[]

The events, each a valid OpenLineage 2-0-2 `RunEvent`.

## Throws

RangeError when `eventTime` is not an ISO 8601 date and time.
