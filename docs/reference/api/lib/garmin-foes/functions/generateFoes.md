[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-foes](../README.md) / generateFoes

# Function: generateFoes()

> **generateFoes**(`stage`, `seed`, `course`, `groundY`): [`Foe`](../interfaces/Foe.md)[]

Lays out one stage's foes: three plus the stage number, picked from
[STAGE\_FOE\_TABLE](../variables/STAGE_FOE_TABLE.md), spread over the stage clear of gaps, with a
Rep Max halfway along stages 3 and 5. A Auto Lap prefers the top
of a block.

## Parameters

### stage

`number`

### seed

`number`

### course

[`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

### groundY

`number`

## Returns

[`Foe`](../interfaces/Foe.md)[]
