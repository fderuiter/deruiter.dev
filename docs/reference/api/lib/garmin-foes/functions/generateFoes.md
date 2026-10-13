[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-foes](../README.md) / generateFoes

# Function: generateFoes()

> **generateFoes**(`stage`, `seed`, `course`, `groundY`, `theme?`): [`Foe`](../interfaces/Foe.md)[]

Lays out one stage's foes: three plus the stage number, picked from
[STAGE\_FOE\_TABLE](../variables/STAGE_FOE_TABLE.md), spread over the stage clear of gaps, with a
Rep Max halfway along stages 3 and 5. A Auto Lap prefers the top
of a block. Water themes (pool, open water) pick from
[WATER\_FOE\_TABLE](../variables/WATER_FOE_TABLE.md) instead; a Lost Goggles slot places a pair.

## Parameters

### stage

`number`

### seed

`number`

### course

[`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

### groundY

`number`

### theme?

[`StageTheme`](../../garmin-themes/type-aliases/StageTheme.md) = `"track"`

## Returns

[`Foe`](../interfaces/Foe.md)[]
