[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/arcade-achievements](../README.md) / recordRun

# Function: recordRun()

> **recordRun**(`gameId`, `run`): `object`

Records a finished run: keeps the best score, checks trophies and tells
the hub, as [recordArcadeScore](recordArcadeScore.md) does, with the run's view, mode and
duration passed on in the event's metadata.

## Parameters

### gameId

`string`

The game's registry slug.

### run

[`ArcadeRun`](../interfaces/ArcadeRun.md)

The finished run.

## Returns

`object`

The progress after the run and the trophies it unlocked.

### newlyUnlocked

> **newlyUnlocked**: [`ArcadeTrophy`](../interfaces/ArcadeTrophy.md)[]

### progress

> **progress**: [`ArcadeProgress`](../interfaces/ArcadeProgress.md)
