[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-foes](../README.md) / Foe

# Interface: Foe

A foe on the course.

## Properties

### baseY?

> `optional` **baseY?**: `number`

Flight line for a Move Alert.

***

### graceMs

> **graceMs**: `number`

Time left in which the foe can't be hurt again (or a kicked shell can't hurt the runner).

***

### height

> **height**: `number`

***

### hp

> **hp**: `number`

Hit points left; only the Rep Max has more than one.

***

### id

> **id**: `number`

***

### kind

> **kind**: [`FoeKind`](../type-aliases/FoeKind.md)

***

### mode

> **mode**: [`FoeMode`](../type-aliases/FoeMode.md)

***

### phase?

> `optional` **phase?**: `number`

Wave phase for a Move Alert, in radians.

***

### throwMs?

> `optional` **throwMs?**: `number`

Counts down to the Rep Max's next dumbbell while it is on the face.

***

### timerMs

> **timerMs**: `number`

Counts down to the next hop or shot.

***

### vx

> **vx**: `number`

World pixels per 60 Hz frame.

***

### vy

> **vy**: `number`

***

### width

> **width**: `number`

***

### x

> **x**: `number`

***

### y

> **y**: `number`
