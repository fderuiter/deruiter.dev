[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-ghost-store](../README.md) / loadGhost

# Function: loadGhost()

> **loadGhost**(`setup`): [`GhostTrack`](../../garmin-ghost/interfaces/GhostTrack.md) \| `null`

The ghost for a race, or null when there is none or it is corrupt. Both
targets read the same ghost: this device keeps one profile, so its PR is
also its course record. Never throws.

## Parameters

### setup

[`RaceSetup`](../../garmin-race/interfaces/RaceSetup.md)

## Returns

[`GhostTrack`](../../garmin-ghost/interfaces/GhostTrack.md) \| `null`
