[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-props](../README.md) / propFootings

# Function: propFootings()

> **propFootings**(`props`, `clockMs`, `groundY`): [`PropFooting`](../interfaces/PropFooting.md)[]

Every standable surface at clockMs: station tops (groundY - height), plyo
tops (groundY - height), belt tops at their current offset (belt.x+dx ..
+width, top belt.y+dy), and unpressed switch tops (groundY - SWITCH_HEIGHT,
width SWITCH_WIDTH). Pressed switches are omitted.

## Parameters

### props

[`CourseProps`](../interfaces/CourseProps.md)

### clockMs

`number`

### groundY

`number`

## Returns

[`PropFooting`](../interfaces/PropFooting.md)[]
