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

> **contents**: `"suit"` \| `"cape"` \| `"kudos"` \| `"power"` \| `"high"` \| `"buddy"`

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

### used

> **used**: `boolean`

***

### x

> **x**: `number`

***

### y

> **y**: `number`

Top surface.
