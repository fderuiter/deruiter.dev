[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-course](../README.md) / generateStage

# Function: generateStage()

> **generateStage**(`stage`, `seed`, `groundY`, `theme?`): [`CourseLayout`](../interfaces/CourseLayout.md)

Lays out one stage. Layouts get harder by stage: wider gaps, more of them,
fewer gentle stretches. `groundY` is the lane's top edge. The theme only
changes what a water stage's second power block holds (a Compression Suit,
not a Cape), and adds Basement Gym racks or Open Water currents. The track
path draws the same random numbers as before the theme existed.

## Parameters

### stage

`number`

### seed

`number`

### groundY

`number`

### theme?

[`StageTheme`](../../garmin-themes/type-aliases/StageTheme.md) = `"track"`

## Returns

[`CourseLayout`](../interfaces/CourseLayout.md)
