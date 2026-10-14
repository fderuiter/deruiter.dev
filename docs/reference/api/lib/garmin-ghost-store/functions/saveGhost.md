[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-ghost-store](../README.md) / saveGhost

# Function: saveGhost()

> **saveGhost**(`setup`, `track`, `date`): `boolean`

Stores `track` as the ghost for a race, replacing the one before. Ghosts
that can no longer be raced (another day's Daily Workout or an older course
version) are dropped first. Ghosts past [MAX\_GHOSTS](../variables/MAX_GHOSTS.md) are dropped
oldest first, and so are more when
storage is too full to take the new one. Returns whether it was stored.
Never throws.

## Parameters

### setup

[`RaceSetup`](../../garmin-race/interfaces/RaceSetup.md)

### track

[`GhostTrack`](../../garmin-ghost/interfaces/GhostTrack.md)

### date

`Date`

## Returns

`boolean`
