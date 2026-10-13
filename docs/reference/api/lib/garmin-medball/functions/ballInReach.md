[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-medball](../README.md) / ballInReach

# Function: ballInReach()

> **ballInReach**(`balls`, `left`, `right`, `feetY`): [`CourseMedBall`](../../garmin-course/interfaces/CourseMedBall.md) \| `null`

The resting ball within reach of a runner whose body spans `left` to
`right` (world px) with its feet at `feetY`, or null. Only a ball resting
on the same footing counts.

## Parameters

### balls

readonly [`CourseMedBall`](../../garmin-course/interfaces/CourseMedBall.md)[] \| `undefined`

### left

`number`

### right

`number`

### feetY

`number`

## Returns

[`CourseMedBall`](../../garmin-course/interfaces/CourseMedBall.md) \| `null`
