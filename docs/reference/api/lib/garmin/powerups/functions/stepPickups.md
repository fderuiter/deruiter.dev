[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/powerups](../README.md) / stepPickups

# Function: stepPickups()

> **stepPickups**(`pickups`, `course`, `groundY`, `cameraX`, `canvasSize`, `deltaMs`): [`Pickup`](../interfaces/Pickup.md)[]

Moves pickups one tick: emerging ones rise out of their block, the rest
travel, fall under gravity, land on the lane, ledges and blocks, and drop
through gaps. A Runner's High bounces on landing. Pickups that fall off
the face or scroll behind `cameraX` are dropped.

## Parameters

### pickups

readonly [`Pickup`](../interfaces/Pickup.md)[]

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

[`Pickup`](../interfaces/Pickup.md)[]
