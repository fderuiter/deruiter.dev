[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / recordStationSubmission

# Function: recordStationSubmission()

> **recordStationSubmission**(`stations`, `domain`): [`StationConfig`](../../types/interfaces/StationConfig.md)[]

Counts a locked CRF at its station.

## Parameters

### stations

[`StationConfig`](../../types/interfaces/StationConfig.md)[]

The active stations.

### domain

[`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)

The station the CRF was routed to.

## Returns

[`StationConfig`](../../types/interfaces/StationConfig.md)[]

New stations with that station's count incremented.
