[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/race-store](../README.md) / loadBoard

# Function: loadBoard()

> **loadBoard**(`course`, `category`, `seed`): [`BoardEntry`](../../race/interfaces/BoardEntry.md)[]

The local board for a course, category and seed, fastest first. Only
entries for this seed at the current [COURSE\_VERSION](../../race/variables/COURSE_VERSION.md) count. Never throws.

## Parameters

### course

[`RaceCourse`](../../race/type-aliases/RaceCourse.md)

### category

[`RaceCategory`](../../race/type-aliases/RaceCategory.md)

### seed

`number`

## Returns

[`BoardEntry`](../../race/interfaces/BoardEntry.md)[]
