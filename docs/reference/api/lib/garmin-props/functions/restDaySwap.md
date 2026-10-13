[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-props](../README.md) / restDaySwap

# Function: restDaySwap()

> **restDaySwap**(`course`, `resting`): [`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

Rest Day swap. resting=true: every brick block without fromKudos (except
one hiding a medal) becomes a Kudos, and every Kudos without fromBrick becomes a brick. resting=false
reverses only the flagged ones, clearing the flags. Sync blocks, gaps,
ledges and poles are untouched.

## Parameters

### course

[`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

### resting

`boolean`

## Returns

[`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)
