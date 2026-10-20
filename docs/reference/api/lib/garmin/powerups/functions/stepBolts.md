[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/powerups](../README.md) / stepBolts

# Function: stepBolts()

> **stepBolts**(`bolts`, `course`, `groundY`, `cameraX`, `canvasSize`, `deltaMs`): [`Bolt`](../interfaces/Bolt.md)[]

Moves heat bolts one tick. A bolt falls, bounces off the lane, ledges and
block tops, and is gone when it drops into a gap and off the face, runs
into the side of a block, or leaves the face ahead of `cameraX`.

## Parameters

### bolts

readonly [`Bolt`](../interfaces/Bolt.md)[]

### course

[`CourseLayout`](../../course/interfaces/CourseLayout.md)

### groundY

`number`

### cameraX

`number`

### canvasSize

`number`

### deltaMs

`number`

## Returns

[`Bolt`](../interfaces/Bolt.md)[]
