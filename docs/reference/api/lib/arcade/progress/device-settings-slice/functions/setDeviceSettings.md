[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/device-settings-slice](../README.md) / setDeviceSettings

# Function: setDeviceSettings()

> **setDeviceSettings**(`patch`): `boolean`

Changes some of this device's cabinet settings and keeps the rest. Values
out of range are settled the same way a stored value is: volumes are
clamped to 0 to 1 and an unknown option keeps its default.

## Parameters

### patch

[`ArcadeDeviceSettingsPatch`](../type-aliases/ArcadeDeviceSettingsPatch.md)

The fields to change.

## Returns

`boolean`

True when the settings reached localStorage.
