[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-props](../README.md) / beltOffset

# Function: beltOffset()

> **beltOffset**(`belt`, `clockMs`): `object`

Belt offset at clockMs: a triangle wave from 0 out to `range` and back over
periodMs, starting at 0 when clockMs=0. Non-finite clock or periodMs <= 0 or
non-finite gives {dx:0, dy:0}. Axis "x" moves dx, axis "y" moves dy.

## Parameters

### belt

[`CourseBelt`](../interfaces/CourseBelt.md)

### clockMs

`number`

## Returns

`object`

### dx

> **dx**: `number`

### dy

> **dy**: `number`
