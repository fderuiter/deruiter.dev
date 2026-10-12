[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-foes](../README.md) / stepFoes

# Function: stepFoes()

> **stepFoes**(`foes`, `shots`, `course`, `groundY`, `cameraX`, `canvasSize`, `deltaMs`, `runnerX`, `nextShotId`): `object`

Moves foes and their shots one tick. Foes off to the right of the face
wait; those that fall off the face or scroll well behind the camera are
dropped. Auto Laps and the Rep Max fire only while on the face, at
`runnerX` (the runner's world centre).

## Parameters

### foes

readonly [`Foe`](../interfaces/Foe.md)[]

### shots

readonly [`FoeShot`](../interfaces/FoeShot.md)[]

### course

[`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

### groundY

`number`

### cameraX

`number`

### canvasSize

`number`

### deltaMs

`number`

### runnerX

`number`

### nextShotId

`number`

## Returns

`object`

### foes

> **foes**: [`Foe`](../interfaces/Foe.md)[]

### nextShotId

> **nextShotId**: `number`

### shots

> **shots**: [`FoeShot`](../interfaces/FoeShot.md)[]
