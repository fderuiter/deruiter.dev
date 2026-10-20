[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/ghost](../README.md) / encodeGhost

# Function: encodeGhost()

> **encodeGhost**(`track`): `string` \| `null`

Encodes a ghost as a compact string: each sample's distance and height as
a change from the one before, and its stage, power and pose only when they
change. A ghost longer than [GHOST\_MAX\_CHARS](../variables/GHOST_MAX_CHARS.md) is thinned (every other
sample) until it fits. Returns null when even one sample a second will not
fit.

## Parameters

### track

[`GhostTrack`](../interfaces/GhostTrack.md)

## Returns

`string` \| `null`
