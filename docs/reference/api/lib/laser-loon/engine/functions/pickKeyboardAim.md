[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / pickKeyboardAim

# Function: pickKeyboardAim()

> **pickKeyboardAim**(`targets`, `eyeX`, `eyeY`, `width?`): `object`

Where a keyboard shot aims: a soft lock on the nearest live enemy within
a narrow cone ahead of the loon, preferring real enemies over incoming
shots, or straight ahead when nothing is in the cone. Keyboard players
have no pointer, so they aim by flying into line.

## Parameters

### targets

readonly [`Target`](../../types/interfaces/Target.md)[]

All live targets.

### eyeX

`number`

The laser's origin x.

### eyeY

`number`

The laser's origin y.

### width?

`number` = `DEFAULT_CANVAS_WIDTH`

The canvas width.

## Returns

`object`

### x

> **x**: `number`

### y

> **y**: `number`
