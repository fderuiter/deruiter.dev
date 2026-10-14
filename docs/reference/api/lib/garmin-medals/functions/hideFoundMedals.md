[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-medals](../README.md) / hideFoundMedals

# Function: hideFoundMedals()

> **hideFoundMedals**(`course`, `props`, `found`): `object`

The course and props with every medal in `found` taken out, so a stage
laid out again after a lost life never offers a medal twice: free medals
go, a PR Board keeps its board but loses the medal, and a station's bonus
room loses its medal.

## Parameters

### course

[`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

### props

[`CourseProps`](../../garmin-props/interfaces/CourseProps.md)

### found

readonly `number`[] \| `undefined`

## Returns

`object`

### course

> **course**: [`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

### props

> **props**: [`CourseProps`](../../garmin-props/interfaces/CourseProps.md)
