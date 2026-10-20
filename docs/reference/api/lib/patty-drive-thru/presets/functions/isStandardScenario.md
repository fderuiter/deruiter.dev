[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/presets](../README.md) / isStandardScenario

# Function: isStandardScenario()

> **isStandardScenario**(`config`): `boolean`

True when a shift has no scenario dial set, no hand-built orders (#2519)
and is not a day of the week mode, so its own score counts. A week's days
add up to the week's score instead (#2086).

## Parameters

### config

`Partial`\<[`ShiftConfig`](../../types/interfaces/ShiftConfig.md)\>

## Returns

`boolean`
