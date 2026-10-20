[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/engine](../README.md) / BonusRoom

# Interface: BonusRoom

A bonus room in progress: the course outside waits to be restored.

## Properties

### endX

> **endX**: `number`

World x of the room's far wall; reaching it leaves the room.

***

### exitX

> **exitX**: `number`

World x the runner comes out at.

***

### returnCourse

> **returnCourse**: [`CourseLayout`](../../course/interfaces/CourseLayout.md)

The course and props outside the room.

***

### returnFoes

> **returnFoes**: [`Foe`](../../foes/interfaces/Foe.md)[]

***

### returnPickups

> **returnPickups**: [`Pickup`](../../powerups/interfaces/Pickup.md)[]

Power-ups that were travelling the course at the door.

***

### returnProps

> **returnProps**: [`CourseProps`](../../props/interfaces/CourseProps.md)
