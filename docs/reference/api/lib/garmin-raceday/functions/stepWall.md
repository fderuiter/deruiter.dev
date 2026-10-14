[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-raceday](../README.md) / stepWall

# Function: stepWall()

> **stepWall**(`wall`, `cameraX`, `deltaMs`, `nextShotId`): `object`

Moves The Wall one step at `cameraX`. "idle" walks it to its hold and
counts down the hold, throwing its bricks; "walk" is a charge, which ends
off the left of the face and sends it back in from the right.

## Parameters

### wall

[`Foe`](../../garmin-foes/interfaces/Foe.md)

### cameraX

`number`

### deltaMs

`number`

### nextShotId

`number`

## Returns

`object`

### nextShotId

> **nextShotId**: `number`

### shots

> **shots**: [`FoeShot`](../../garmin-foes/interfaces/FoeShot.md)[]

### wall

> **wall**: [`Foe`](../../garmin-foes/interfaces/Foe.md)
