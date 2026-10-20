[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/medball](../README.md) / stepThrownBall

# Function: stepThrownBall()

> **stepThrownBall**(`ball`, `course`, `groundY`, `cameraX`, `canvasSize`, `deltaMs`): `object`

Moves a thrown ball one tick. It falls under gravity; on the lane or a
ledge it rolls on, slowing, and once it is slow enough it comes to rest
there, returned as `landed`. A ball that drops off the face or leaves the
view is gone (both null).

## Parameters

### ball

[`ThrownBall`](../interfaces/ThrownBall.md)

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

`object`

### ball

> **ball**: [`ThrownBall`](../interfaces/ThrownBall.md) \| `null`

### landed

> **landed**: [`CourseMedBall`](../../course/interfaces/CourseMedBall.md) \| `null`
