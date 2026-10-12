[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / pickKeyboardAim

# Function: pickKeyboardAim()

> **pickKeyboardAim**(`targets`, `eyeX`, `eyeY`, `width?`): `object`

Where a keyboard shot aims: the nearest live enemy ahead of the loon,
preferring real enemies over incoming shots, or straight ahead when the
sky is clear. Keyboard players have no pointer to aim with.

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
