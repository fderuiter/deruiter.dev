[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-props](../README.md) / generateStageProps

# Function: generateStageProps()

> **generateStageProps**(`stage`, `seed`, `groundY`, `layout`): `object`

Lays out a stage's props, deterministic for (stage, seed). Returns the props
and the layout with any ledge a belt replaces removed (everything else in
the layout unchanged).

## Parameters

### stage

`number`

### seed

`number`

### groundY

`number`

### layout

[`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

## Returns

`object`

### layout

> **layout**: [`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

### props

> **props**: [`CourseProps`](../interfaces/CourseProps.md)
