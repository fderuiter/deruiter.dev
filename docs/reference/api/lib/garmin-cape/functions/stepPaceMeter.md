[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-cape](../README.md) / stepPaceMeter

# Function: stepPaceMeter()

> **stepPaceMeter**(`meter`, `grounded`, `sprinting`, `deltaMs`, `fillScale?`): `number`

The meter after `deltaMs`. Sprinting on the track fills it, running or
braking on the track drains it, and in the air it holds. `fillScale`
(default 1) slows only the fill, as carrying a medicine ball does (#2024);
the drain is untouched.

## Parameters

### meter

`number` \| `undefined`

### grounded

`boolean`

### sprinting

`boolean`

### deltaMs

`number`

### fillScale?

`number` = `1`

## Returns

`number`
