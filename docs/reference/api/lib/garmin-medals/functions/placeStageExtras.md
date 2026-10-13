[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-medals](../README.md) / placeStageExtras

# Function: placeStageExtras()

> **placeStageExtras**(`course`, `props`, `stage`, `seed`, `groundY`, `theme`, `bodyWidth`): `object`

Places the medals, the checkpoint and the secret exit of #2025 on a laid
out stage, from their own random stream so the stage's other draws are
untouched. Returns new course and props; the inputs are not mutated.

Slot order: a PR Board medal (land stages with a board after a Protein
Shake block), a bonus room medal (stages with an enterable station), then
free medals over a ledge, a block row or the lane, at least 60 px apart,
clear of racks and props and of the stretch the room skips. On stages 1 to
`STAGE_COUNT - 1`, most with an enterable station past the Aid Station end
the last such station's bonus room at a secret pole; then every course
medal sits before that station.

## Parameters

### course

[`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

### props

[`CourseProps`](../../garmin-props/interfaces/CourseProps.md)

### stage

`number`

### seed

`number`

### groundY

`number`

### theme

[`StageTheme`](../../garmin-themes/type-aliases/StageTheme.md)

### bodyWidth

`number`

## Returns

`object`

### course

> **course**: [`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

### props

> **props**: [`CourseProps`](../../garmin-props/interfaces/CourseProps.md)
