[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/ghost](../README.md) / GhostTrack

# Interface: GhostTrack

A ghost: its samples, the run's lap times and its finish time.

## Properties

### intervalMs

> **intervalMs**: `number`

Run clock between samples, in ms: [GHOST\_SAMPLE\_MS](../variables/GHOST_SAMPLE_MS.md), or a multiple when thinned to fit.

***

### lapEndsMs

> **lapEndsMs**: `number`[]

Run clock at the end of each lap, in ms.

***

### samples

> **samples**: [`GhostSample`](GhostSample.md)[]

Sample `i` is the runner at run clock `i * intervalMs`.

***

### timeMs

> **timeMs**: `number`

The run's finish time, in ms.
