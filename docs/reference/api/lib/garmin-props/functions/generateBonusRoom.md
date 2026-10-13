[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-props](../README.md) / generateBonusRoom

# Function: generateBonusRoom()

> **generateBonusRoom**(`startX`, `seed`, `groundY`): [`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

A bonus room laid out from startX: flat floor (no gaps), no poles, two rows
of Kudos every 30 px (34 in all, worth a little more than a stage clear),
and two ledges. Kudos ids start at 900000 + (seed mod
1000) * 100 so they never clash with stage ids.

## Parameters

### startX

`number`

### seed

`number`

### groundY

`number`

## Returns

[`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)
