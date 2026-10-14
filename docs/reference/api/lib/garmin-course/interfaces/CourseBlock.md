[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-course](../README.md) / CourseBlock

# Interface: CourseBlock

A block floating over the lane. Bumping a Sync Block from below pops its
contents once: Kudos, a power-up (a Protein Shake for a Base runner, then
a Heat Map from a power block or a Compression Cape from a cape block), or
a Runner's High, or on some land stages a Running Buddy (#2024). A brick is
plain solid footing.

## Properties

### contents

> **contents**: `"suit"` \| `"cape"` \| `"kudos"` \| `"power"` \| `"high"` \| `"buddy"` \| `"medal"` \| `"wind"`

***

### fromKudos?

> `optional` **fromKudos?**: `boolean`

A Kudos turned into a brick by a Rest Day (#1992); it turns back after.

***

### id

> **id**: `number`

***

### kind

> **kind**: `"sync"` \| `"brick"`

***

### medalId?

> `optional` **medalId?**: `number`

Id of the Finisher Medal a PR Board hides, found by breaking it (#2025),
or that a Second Wind block pays out when its goal is met (#2026).

***

### used

> **used**: `boolean`

***

### windKind?

> `optional` **windKind?**: [`SecondWindKind`](../../garmin-second-wind/type-aliases/SecondWindKind.md)

The event a Second Wind block starts (#2026).

***

### x

> **x**: `number`

***

### y

> **y**: `number`

Top surface.
