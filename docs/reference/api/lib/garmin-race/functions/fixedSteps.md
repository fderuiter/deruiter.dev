[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-race](../README.md) / fixedSteps

# Function: fixedSteps()

> **fixedSteps**(`carryMs`, `deltaMs`): `object`

Splits a frame's `deltaMs` into fixed steps. Returns how many
[FIXED\_STEP\_MS](../variables/FIXED_STEP_MS.md) steps to run and the time carried to the next frame.
A frame never runs more than [MAX\_STEPS\_PER\_FRAME](../variables/MAX_STEPS_PER_FRAME.md); the excess is
dropped, not carried, so a long stall can't run the race on its own.

## Parameters

### carryMs

`number`

### deltaMs

`number`

## Returns

`object`

### carryMs

> **carryMs**: `number`

### steps

> **steps**: `number`
