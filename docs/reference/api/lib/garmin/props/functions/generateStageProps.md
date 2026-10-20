[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/props](../README.md) / generateStageProps

# Function: generateStageProps()

> **generateStageProps**(`stage`, `seed`, `groundY`, `layout`, `theme?`): `object`

Lays out a stage's props, deterministic for (stage, seed). Returns the props
and the layout with any ledge a belt replaces removed (everything else in
the layout unchanged). Water stages keep no belts over gaps and gain buoys
on open water; every spot clears the layout's Basement Gym racks too.

## Parameters

### stage

`number`

### seed

`number`

### groundY

`number`

### layout

[`CourseLayout`](../../course/interfaces/CourseLayout.md)

### theme?

[`StageTheme`](../../themes/type-aliases/StageTheme.md) = `"track"`

## Returns

`object`

### layout

> **layout**: [`CourseLayout`](../../course/interfaces/CourseLayout.md)

### props

> **props**: [`CourseProps`](../interfaces/CourseProps.md)
